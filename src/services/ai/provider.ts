import { prisma } from "@/lib/db";

export type AiMessage = { role: "system" | "user" | "assistant"; content: string };

export async function recordUsage(
  websiteId: string,
  provider: string,
  kind: string,
  units: number,
  estimatedUsd: number,
  meta?: unknown
) {
  await prisma.usageRecord.create({
    data: {
      websiteId,
      provider,
      kind,
      units,
      estimatedUsd,
      metaJson: meta ? JSON.stringify(meta) : undefined,
    },
  });
}

export async function withinBudget(websiteId: string): Promise<boolean> {
  const settings = await prisma.websiteSettings.findUnique({ where: { websiteId } });
  if (!settings) return true;
  const since = new Date();
  since.setDate(1);
  since.setHours(0, 0, 0, 0);
  const agg = await prisma.usageRecord.aggregate({
    where: { websiteId, createdAt: { gte: since } },
    _sum: { estimatedUsd: true },
  });
  return (agg._sum.estimatedUsd ?? 0) < settings.maxUsageBudgetUsd;
}

function grokKey() {
  return process.env.GROK_API_KEY || process.env.XAI_API_KEY || "";
}

async function callOpenAICompatible(input: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: AiMessage[];
}): Promise<string> {
  const res = await fetch(`${input.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      messages: input.messages,
      temperature: 0.4,
    }),
  });
  if (!res.ok) {
    throw new Error(`AI provider error: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  return data.choices[0]?.message?.content ?? "";
}

async function callGrok(messages: AiMessage[]): Promise<string> {
  const key = grokKey();
  if (!key) throw new Error("GROK_API_KEY (or XAI_API_KEY) not configured");
  const model = process.env.GROK_MODEL || "grok-2-latest";
  return callOpenAICompatible({
    baseUrl: process.env.GROK_BASE_URL || "https://api.x.ai/v1",
    apiKey: key,
    model,
    messages,
  });
}

async function callOpenAI(messages: AiMessage[], model = "gpt-4o-mini"): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not configured");
  return callOpenAICompatible({
    baseUrl: "https://api.openai.com/v1",
    apiKey: key,
    model,
    messages,
  });
}

async function callAnthropic(messages: AiMessage[]): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not configured");
  const system = messages.find((m) => m.role === "system")?.content;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-latest",
      max_tokens: 4096,
      system,
      messages: messages.filter((m) => m.role !== "system"),
    }),
  });
  if (!res.ok) throw new Error(`Anthropic error: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { content: { text: string }[] };
  return data.content.map((c) => c.text).join("\n");
}

/** Deterministic offline generator when no AI keys are present. */
function offlineGenerate(messages: AiMessage[]): string {
  const user = messages.find((m) => m.role === "user")?.content ?? "";
  const topicMatch = user.match(/topic[:\s]+(.+)/i);
  const topic = topicMatch?.[1]?.split("\n")[0]?.trim() || "Untitled Topic";
  return JSON.stringify({
    title: topic,
    seoTitle: `${topic} | Practical Guide`,
    metaDescription: `An original overview of ${topic}, including key concepts, practical steps, and FAQs.`,
    slug: topic
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60),
    outline: [
      "Introduction",
      "Key concepts",
      "Practical steps",
      "Common pitfalls",
      "FAQ",
      "Conclusion",
    ],
    contentMarkdown: `# ${topic}

## Introduction
This article provides an original, practical overview of **${topic}**.

## Key concepts
- Clarify goals and audience
- Gather trustworthy sources before drafting
- Structure content around search intent

## Practical steps
1. Audit existing coverage
2. Draft with clear headings
3. Add internal links and FAQs where useful
4. Validate SEO metadata

## Common pitfalls
Avoid inventing statistics or citations. Label estimates clearly.

## FAQ
### Is this ranking advice guaranteed?
No. Recommendations use available data and never claim guaranteed ranking improvements.

### Can I edit this draft?
Yes. Manual edits are preserved and will not be silently overwritten by autopilot.

## Conclusion
Use this draft as a starting point, then refine with subject-matter expertise.
`,
    faqs: [
      {
        q: "Is this ranking advice guaranteed?",
        a: "No. Recommendations never claim guaranteed ranking improvements.",
      },
    ],
    citations: [],
  });
}

export function resolveDefaultAiProvider(): string {
  if (grokKey()) return "grok";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return "offline";
}

export async function generateText(input: {
  websiteId: string;
  provider?: string;
  messages: AiMessage[];
  kind?: string;
}): Promise<{ text: string; provider: string; offline: boolean }> {
  if (!(await withinBudget(input.websiteId))) {
    throw new Error("Website AI usage budget exceeded for this month");
  }

  const settings = await prisma.websiteSettings.findUnique({
    where: { websiteId: input.websiteId },
  });
  const preferred =
    input.provider || settings?.aiProvider || resolveDefaultAiProvider();

  const attempts: { name: string; run: () => Promise<string>; cost: number }[] = [];

  if (preferred === "grok" || grokKey()) {
    attempts.push({ name: "grok", run: () => callGrok(input.messages), cost: 0.01 });
  }
  if (preferred === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    attempts.push({
      name: "anthropic",
      run: () => callAnthropic(input.messages),
      cost: 0.01,
    });
  }
  if (preferred === "openai" || process.env.OPENAI_API_KEY) {
    attempts.push({
      name: "openai",
      run: () => callOpenAI(input.messages),
      cost: 0.01,
    });
  }

  // Prefer exact match first
  attempts.sort((a, b) => (a.name === preferred ? -1 : b.name === preferred ? 1 : 0));

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      const text = await attempt.run();
      if (text?.trim()) {
        await recordUsage(
          input.websiteId,
          attempt.name,
          input.kind ?? "chat",
          1,
          attempt.cost
        );
        return { text, provider: attempt.name, offline: false };
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (process.env.ALLOW_OFFLINE_AI !== "true" && process.env.NODE_ENV === "production") {
    throw lastError instanceof Error
      ? lastError
      : new Error("All AI providers failed");
  }

  const text = offlineGenerate(input.messages);
  await recordUsage(input.websiteId, "offline", input.kind ?? "chat", 1, 0, {
    note: "Offline generator — configure GROK_API_KEY for Grok writing",
    lastError: lastError instanceof Error ? lastError.message : undefined,
  });
  return { text, provider: "offline", offline: true };
}

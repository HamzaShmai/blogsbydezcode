/**
 * Central security helpers: secret redaction, env validation, password rules.
 * Never return ciphertext fields, password hashes, or raw provider tokens to clients.
 */

const SECRET_KEYS = new Set([
  "passwordHash",
  "password",
  "credentialsEnc",
  "gscTokensEnc",
  "applicationPassword",
  "accessToken",
  "githubToken",
  "webhookSecret",
  "refresh_token",
  "access_token",
  "NEXTAUTH_SECRET",
  "CREDENTIALS_ENCRYPTION_KEY",
  "QSTASH_TOKEN",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "DATABASE_URL",
  "GOOGLE_CLIENT_SECRET",
  "TAVILY_API_KEY",
  "SERPAPI_API_KEY",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date);
}

/** Deep-clone JSON-safe data while stripping secret keys and never echoing env. */
export function sanitizeForClient<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((item) => sanitizeForClient(item)) as T;
  }
  if (input instanceof Date) return input;
  if (!isPlainObject(input)) return input;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (SECRET_KEYS.has(key)) continue;
    if (key.endsWith("Enc") || key.endsWith("Hash") || key.endsWith("Secret")) continue;
    if (key.toLowerCase().includes("password") && key !== "passwordHint") continue;
    out[key] = sanitizeForClient(value);
  }

  // Safe presence flags (never the secret itself)
  if ("credentialsEnc" in input) {
    out.hasCredentials = Boolean((input as Record<string, unknown>).credentialsEnc);
  }
  if ("gscTokensEnc" in input) {
    out.hasGsc = Boolean((input as Record<string, unknown>).gscTokensEnc);
  }

  return out as T;
}

export function assertSecureEnv() {
  const missing: string[] = [];
  const weak: string[] = [];

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) missing.push("NEXTAUTH_SECRET");
  else if (secret.length < 32 || /change-me|local-dev|secret/i.test(secret)) {
    if (process.env.NODE_ENV === "production") weak.push("NEXTAUTH_SECRET");
  }

  const enc = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!enc) missing.push("CREDENTIALS_ENCRYPTION_KEY");
  else if (enc.length < 32 || /change-me|local-dev|dev-only/i.test(enc)) {
    if (process.env.NODE_ENV === "production") weak.push("CREDENTIALS_ENCRYPTION_KEY");
  }

  if (process.env.NODE_ENV === "production") {
    if (missing.length || weak.length) {
      throw new Error(
        `Insecure production configuration: missing=[${missing.join(",")}] weak=[${weak.join(",")}]`
      );
    }
    if (process.env.JOBS_INLINE === "true") {
      throw new Error("JOBS_INLINE cannot be true in production — use signed QStash workers");
    }
    if (process.env.ALLOW_OFFLINE_AI === "true") {
      // Allowed but logged mentally — not a secret leak; no throw
    }
  }

  return { missing, weak };
}

export function validatePassword(password: string): string | null {
  if (password.length < 12) return "Password must be at least 12 characters";
  if (!/[A-Z]/.test(password)) return "Password needs an uppercase letter";
  if (!/[a-z]/.test(password)) return "Password needs a lowercase letter";
  if (!/[0-9]/.test(password)) return "Password needs a number";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password needs a symbol character";
  return null;
}

export function publicWebsiteSelect() {
  return {
    id: true,
    organizationId: true,
    name: true,
    domain: true,
    cmsType: true,
    gscProperty: true,
    createdAt: true,
    updatedAt: true,
  } as const;
}

import { PrismaClient } from "@prisma/client";
import { runBacklinkAgent } from "../src/services/backlinks/agent";

const prisma = new PrismaClient();

async function main() {
  const sites = await prisma.website.findMany({
    select: { id: true, name: true, domain: true },
    orderBy: { updatedAt: "desc" },
  });

  console.log(`Found ${sites.length} website(s)\n`);

  if (!sites.length) {
    console.log("No websites in DB. Add one in /agency/websites first.");
    return;
  }

  for (const site of sites) {
    console.log(`\n=== Running backlink agent: ${site.name} (${site.domain}) ===`);
    try {
      const result = await runBacklinkAgent(site.id);
      console.log(
        `Niche: ${result.niche} | Catalog: ${result.catalogSize} | Created: ${result.created} | Total: ${result.total}`
      );
      console.log(`Top 15 of ${result.total}:`);
      for (const p of result.prospects.slice(0, 15)) {
        console.log(
          `- [${Math.round(p.score)}] ${p.kind} | ${p.domain} | ${p.url}`
        );
      }
    } catch (e) {
      console.error(`Failed for ${site.domain}:`, e instanceof Error ? e.message : e);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

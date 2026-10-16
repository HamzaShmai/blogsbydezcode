import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { compare } from "bcryptjs";

async function main() {
  const p = new PrismaClient();
  const u = await p.user.findUnique({ where: { email: "agency@pulserank.local" } });
  console.log("user", u?.email);
  console.log("ok", u ? await compare("password123", u.passwordHash) : false);
  await p.$disconnect();
}

main();

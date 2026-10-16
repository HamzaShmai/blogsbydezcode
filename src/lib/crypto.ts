import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function getKey(): Buffer {
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!raw || raw.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CREDENTIALS_ENCRYPTION_KEY must be set (32+ chars) in production");
    }
    // Local-only deterministic key derived from a non-secret label — never used in production
    if (!raw) {
      console.warn("[security] CREDENTIALS_ENCRYPTION_KEY missing — using insecure local-only key");
    }
    return createHash("sha256")
      .update(`local-only:${raw || "pulserank-local"}`)
      .digest();
  }
  return createHash("sha256").update(raw).digest();
}

export function encryptJson(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptJson<T = unknown>(payload: string): T {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8")) as T;
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function contentHash(title: string, body: string): string {
  return sha256(`${title.trim().toLowerCase()}\n${body.trim()}`);
}

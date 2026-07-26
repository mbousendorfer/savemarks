import { createHash, randomBytes } from "node:crypto";

const PAIRING_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function pepper(): string {
  const value = process.env.SAVEMARKS_TOKEN_PEPPER;
  if (!value || value.length < 24) {
    throw new Error("SAVEMARKS_TOKEN_PEPPER must contain at least 24 characters");
  }
  return value;
}

export function hashSecret(value: string): string {
  return createHash("sha256").update(value).update(pepper()).digest("hex");
}

export function createPairingCode(): string {
  const bytes = randomBytes(8);
  return [...bytes]
    .map((byte) => PAIRING_ALPHABET[byte % PAIRING_ALPHABET.length])
    .join("");
}

export function createApiToken(): string {
  return randomBytes(32).toString("base64url");
}

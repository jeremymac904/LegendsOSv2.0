import crypto from "node:crypto";

import { getServerEnv } from "@/lib/env";

export interface OAuthStatePayload {
  provider: string;
  target_user_id: string;
  issued_at: number;
}

const STATE_VERSION = "v1";
const STATE_TTL_MS = 15 * 60 * 1000;
const SECRET_ALGO = "aes-256-gcm";
const SECRET_IV_BYTES = 12;

function readSecretMaterial(): string {
  const env = getServerEnv();
  const secret = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error(
      "SUPABASE_SECRET_KEY is required to encrypt social integration secrets."
    );
  }
  return secret;
}

function deriveKey(): Buffer {
  return crypto.createHash("sha256").update(readSecretMaterial()).digest();
}

function base64url(input: Buffer | string): string {
  return Buffer.isBuffer(input)
    ? input.toString("base64url")
    : Buffer.from(input, "utf8").toString("base64url");
}

function fromBase64url(input: string): Buffer {
  return Buffer.from(input, "base64url");
}

function timingSafeEqualString(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function createOAuthState(payload: Omit<OAuthStatePayload, "issued_at">): string {
  const signed: OAuthStatePayload = {
    ...payload,
    issued_at: Date.now(),
  };
  const body = base64url(JSON.stringify(signed));
  const sig = crypto
    .createHmac("sha256", deriveKey())
    .update(body)
    .digest("base64url");
  return `${STATE_VERSION}.${body}.${sig}`;
}

export function readOAuthState(state: string): OAuthStatePayload | null {
  const parts = state.split(".");
  if (parts.length !== 3 || parts[0] !== STATE_VERSION) return null;
  const [, body, sig] = parts;
  const expected = crypto
    .createHmac("sha256", deriveKey())
    .update(body)
    .digest("base64url");
  if (!timingSafeEqualString(sig, expected)) return null;

  try {
    const payload = JSON.parse(fromBase64url(body).toString("utf8")) as OAuthStatePayload;
    if (
      !payload ||
      typeof payload.provider !== "string" ||
      typeof payload.target_user_id !== "string" ||
      typeof payload.issued_at !== "number"
    ) {
      return null;
    }
    if (Date.now() - payload.issued_at > STATE_TTL_MS) return null;
    return payload;
  } catch {
    return null;
  }
}

export function encryptSecret(value: string): string {
  const iv = crypto.randomBytes(SECRET_IV_BYTES);
  const cipher = crypto.createCipheriv(SECRET_ALGO, deriveKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    STATE_VERSION,
    base64url(iv),
    base64url(tag),
    base64url(ciphertext),
  ].join(".");
}

export function decryptSecret(payload: string): string {
  const [version, ivRaw, tagRaw, ciphertextRaw] = payload.split(".");
  if (version !== STATE_VERSION || !ivRaw || !tagRaw || !ciphertextRaw) {
    throw new Error("Invalid encrypted payload.");
  }
  const decipher = crypto.createDecipheriv(
    SECRET_ALGO,
    deriveKey(),
    fromBase64url(ivRaw)
  );
  decipher.setAuthTag(fromBase64url(tagRaw));
  const decrypted = Buffer.concat([
    decipher.update(fromBase64url(ciphertextRaw)),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

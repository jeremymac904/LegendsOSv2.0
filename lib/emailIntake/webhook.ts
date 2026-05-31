// LegendsOS v2 — Gmail AI Intake webhook security.
// -------------------------------------------------------------------------
// Every inbound intake webhook (from n8n) must present a shared secret in the
// `x-legendsos-webhook-secret` header that matches LEGENDSOS_WEBHOOK_SECRET.
// FAIL CLOSED: if the env secret is unset, or the header is missing/wrong, the
// request is rejected. The secret is never logged or returned.

import { timingSafeEqual } from "node:crypto";

export const WEBHOOK_SECRET_HEADER = "x-legendsos-webhook-secret";

function configuredSecret(): string {
  // Server-only. Read directly so this util has no dependency on the larger
  // env loader and never echoes the value anywhere.
  return process.env.LEGENDSOS_WEBHOOK_SECRET ?? "";
}

/** Constant-time string compare that tolerates differing lengths. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  try {
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export type WebhookAuthResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string; message: string };

/**
 * Validate the shared-secret header on an inbound webhook request.
 * - 503 if the server has no secret configured (intake not provisioned).
 * - 401 if the header is missing or does not match.
 */
export function verifyWebhookSecret(req: Request): WebhookAuthResult {
  const expected = configuredSecret();
  if (!expected) {
    return {
      ok: false,
      status: 503,
      error: "intake_not_configured",
      message:
        "Email intake is not provisioned. Set LEGENDSOS_WEBHOOK_SECRET in the server environment.",
    };
  }
  const provided = req.headers.get(WEBHOOK_SECRET_HEADER) ?? "";
  if (!provided || !safeEqual(provided, expected)) {
    return {
      ok: false,
      status: 401,
      error: "unauthorized",
      message: "Missing or invalid webhook secret.",
    };
  }
  return { ok: true };
}

/** True only when a webhook secret is configured (for status/UI checks). */
export function isWebhookSecretConfigured(): boolean {
  return Boolean(configuredSecret());
}

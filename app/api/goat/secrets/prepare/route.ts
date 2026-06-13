import { z } from "zod";

import { goatFail, goatLog, goatOk, readJson, withGoat, zodMessage } from "@/lib/goat/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENV_NAME_RE = /^[A-Z][A-Z0-9_]{2,63}$/;

const prepareSchema = z.object({
  service: z.string().min(2).max(80),
  env_var_names: z
    .array(
      z
        .string()
        .regex(
          ENV_NAME_RE,
          "must be an UPPER_SNAKE_CASE environment variable NAME (e.g. OPENAI_API_KEY), never a value"
        )
    )
    .min(1)
    .max(10),
  notes: z.string().max(1000).optional(),
});

// Things that look like actual credentials. If any free-text field matches,
// the request is rejected — this endpoint must NEVER receive secret values.
const SECRET_PATTERNS: RegExp[] = [
  /-----BEGIN/, // PEM keys
  /\beyJ[A-Za-z0-9_-]{10,}/, // JWTs
  /\b(?:sk|pk|rk)-[A-Za-z0-9_-]{16,}/, // OpenAI/Stripe-style keys
  /\bgh[pousr]_[A-Za-z0-9]{20,}/, // GitHub tokens
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/, // Slack tokens
  /\bAKIA[0-9A-Z]{16}\b/, // AWS access keys
  /[A-Za-z0-9+/_-]{40,}={0,2}/, // long opaque blobs (base64-ish)
  /[A-Z0-9_]{2,64}\s*=\s*\S{8,}/, // NAME=value assignments
];

function looksLikeSecret(text: string): boolean {
  return SECRET_PATTERNS.some((re) => re.test(text));
}

function buildFileContent(service: string, names: string[], notes?: string): string {
  const lines: string[] = [
    "==========================================================",
    "  OPEN_ME_ADD_KEYS.txt — action needed from Jeremy",
    "==========================================================",
    "",
    `Service: ${service}`,
    `Created: ${new Date().toISOString()}`,
    "",
    "The GOAT Architect needs the following keys. ONLY YOU add the",
    "values — never paste them into ChatGPT, Claude, or this API.",
    "",
    "KEYS REQUIRED:",
    ...names.map((n) => `  - ${n}`),
    "",
    "WHERE TO ADD THEM:",
    "  1) Production (Netlify):",
    "     - Open https://app.netlify.com → site 'legendsos' →",
    "       Site configuration → Environment variables.",
    ...names.map((n) => `     - Add ${n} = <paste the real value>`),
    "     - Trigger a redeploy (Deploys → Trigger deploy) so functions",
    "       pick up the new values.",
    "  2) Local development:",
    "     - Open /Users/JeremyMcDonald/Desktop/LegendsOSv2.0/.env.local",
    ...names.map((n) => `     - Add a line: ${n}=<paste the real value>`),
    "     - Restart `npm run dev`.",
    "",
    "RULES:",
    "  - Never commit values to git.",
    "  - Never send values through the GPT or this API.",
    "  - This file contains NO secrets — only names and instructions.",
  ];
  if (notes) {
    lines.push("", `NOTES FROM THE GOAT ARCHITECT:`, `  ${notes}`);
  }
  lines.push("", "==========================================================");
  return lines.join("\n");
}

// prepare_secret_file — returns the OPEN_ME_ADD_KEYS.txt content and exact
// steps for Jeremy. Hard guarantee: secret VALUES are rejected on sight.
export const POST = withGoat("/api/goat/secrets/prepare", async (req, ctx) => {
  const raw = await readJson(req);
  if (raw && typeof raw === "object") {
    // Reject any field beyond the contract — a 'value'/'secret' field is the
    // classic way a caller tries to hand us a credential.
    const allowed = new Set(["service", "env_var_names", "notes"]);
    const extras = Object.keys(raw as Record<string, unknown>).filter((k) => !allowed.has(k));
    if (extras.length > 0) {
      return goatFail(
        ctx,
        400,
        "unexpected_fields",
        `Unexpected field(s): ${extras.join(", ")}. This endpoint accepts names and notes only — NEVER secret values.`
      );
    }
  }
  const parsed = prepareSchema.safeParse(raw);
  if (!parsed.success) {
    return goatFail(ctx, 400, "bad_request", zodMessage(parsed.error.issues));
  }
  const { service, env_var_names, notes } = parsed.data;

  for (const text of [service, notes ?? ""]) {
    if (looksLikeSecret(text)) {
      goatLog("warn", ctx, "secret_value_rejected", { field_length: text.length });
      return goatFail(
        ctx,
        400,
        "secret_value_detected",
        "The request contains something that looks like a credential. This endpoint NEVER accepts secret values — send variable NAMES only. Do not retry with the secret."
      );
    }
  }

  const content = buildFileContent(service, env_var_names, notes);
  return goatOk(ctx, {
    file: { name: "OPEN_ME_ADD_KEYS.txt", content },
    instructions: [
      `Tell Jeremy: keys for ${service} are required (${env_var_names.join(", ")}).`,
      "Show him the file content above or save it as OPEN_ME_ADD_KEYS.txt in the project root.",
      "Jeremy adds the values in the Netlify site environment variables and in .env.local — never through chat.",
      "After he adds them, redeploy (production) or restart the dev server (local), then retry the blocked task.",
    ],
    secrets_received: false,
  });
});

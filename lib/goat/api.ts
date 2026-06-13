// GOAT Architect Command API — shared route plumbing.
// ---------------------------------------------------------------------------
// Every /api/goat/* route goes through these helpers so behavior is uniform:
//   * Bearer auth against GOAT_COMMAND_API_KEY (fails closed: 503 unset,
//     401 mismatch). The middleware exempts /api/goat from Supabase session
//     auth specifically because these helpers enforce their own.
//   * Structured single-line JSON logs with a per-request id, so Netlify
//     function logs are grep-able (`goat_api` marker).
//   * One response envelope: { ok, request_id, ...payload } / { ok:false,
//     error, message, request_id } so the Custom GPT can branch on `ok`.
// ---------------------------------------------------------------------------

import { createHash, randomUUID, timingSafeEqual } from "crypto";

import { NextRequest, NextResponse } from "next/server";

export const GOAT_API_VERSION = "1.0.0";
export const GOAT_SERVICE_NAME = "goat-architect-command-api";

/** Exact env var the Bearer token is checked against. Documented in README. */
export const GOAT_API_KEY_ENV = "GOAT_COMMAND_API_KEY";

export interface GoatContext {
  requestId: string;
  route: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function goatLog(
  level: "info" | "warn" | "error",
  ctx: GoatContext,
  event: string,
  extra?: Record<string, unknown>
) {
  const line = JSON.stringify({
    src: "goat_api",
    level,
    time: nowIso(),
    request_id: ctx.requestId,
    route: ctx.route,
    event,
    ...extra,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export function goatOk(
  ctx: GoatContext,
  payload: Record<string, unknown>,
  init?: { status?: number }
) {
  return NextResponse.json(
    { ok: true, request_id: ctx.requestId, ...payload },
    { status: init?.status ?? 200 }
  );
}

export function goatFail(
  ctx: GoatContext,
  status: number,
  error: string,
  message: string,
  extra?: Record<string, unknown>
) {
  goatLog(status >= 500 ? "error" : "warn", ctx, "request_failed", {
    status,
    error,
    message,
  });
  return NextResponse.json(
    { ok: false, error, message, request_id: ctx.requestId, ...extra },
    { status }
  );
}

// Constant-time comparison over fixed-length digests so token length is not
// observable either.
function secretsMatch(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Returns null when the request carries a valid Bearer token, otherwise the
 * error response to send. Fails closed when the key env var is unset.
 */
export function requireGoatAuth(req: NextRequest, ctx: GoatContext): NextResponse | null {
  const expected = process.env[GOAT_API_KEY_ENV] ?? "";
  if (!expected.trim()) {
    return goatFail(
      ctx,
      503,
      "not_configured",
      `${GOAT_API_KEY_ENV} is not set on the server. Set it in the Netlify site environment, then redeploy.`
    );
  }
  const header = req.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token || !secretsMatch(token, expected.trim())) {
    return goatFail(
      ctx,
      401,
      "unauthorized",
      "Missing or invalid Bearer token. Send `Authorization: Bearer <GOAT_COMMAND_API_KEY>`."
    );
  }
  return null;
}

type GoatHandler = (req: NextRequest, ctx: GoatContext) => Promise<NextResponse>;

/**
 * Wraps a route handler with request-id allocation, auth (unless `public`),
 * start/finish logs, and a JSON 500 catch-all so callers never see an HTML
 * error page.
 */
export function withGoat(
  route: string,
  handler: GoatHandler,
  opts?: { public?: boolean }
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    const ctx: GoatContext = { requestId: randomUUID(), route };
    goatLog("info", ctx, "request_start", { method: req.method });
    if (!opts?.public) {
      const denied = requireGoatAuth(req, ctx);
      if (denied) return denied;
    }
    try {
      const res = await handler(req, ctx);
      goatLog("info", ctx, "request_done", { status: res.status });
      return res;
    } catch (err) {
      goatLog("error", ctx, "unhandled_exception", {
        message: err instanceof Error ? err.message : String(err),
      });
      return goatFail(
        ctx,
        500,
        "internal_error",
        "Unexpected server error. Check Netlify function logs for this request_id."
      );
    }
  };
}

/** Parses a JSON body, returning null (never throwing) on bad/missing JSON. */
export async function readJson(req: NextRequest): Promise<unknown> {
  return req.json().catch(() => null);
}

/** Formats zod issues into one human-readable message line. */
export function zodMessage(issues: { path: (string | number)[]; message: string }[]): string {
  return issues
    .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
    .join("; ");
}

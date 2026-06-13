import { NextResponse } from "next/server";

import {
  GOAT_API_KEY_ENV,
  GOAT_API_VERSION,
  GOAT_SERVICE_NAME,
  withGoat,
} from "@/lib/goat/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// get_health — public on purpose: it's the GPT Builder connectivity test and
// the deploy-verification probe. It reports whether Bearer auth is configured
// without ever revealing the key.
export const GET = withGoat(
  "/api/goat/health",
  async (_req, ctx) => {
    const authConfigured = Boolean((process.env[GOAT_API_KEY_ENV] ?? "").trim());
    return NextResponse.json({
      ok: true,
      status: "ok",
      version: GOAT_API_VERSION,
      message: authConfigured
        ? "GOAT Architect Command API is up. All command endpoints require Bearer auth."
        : `GOAT Architect Command API is up, but ${GOAT_API_KEY_ENV} is not set — command endpoints will return 503 until it is.`,
      service: GOAT_SERVICE_NAME,
      auth_configured: authConfigured,
      time: new Date().toISOString(),
      request_id: ctx.requestId,
    });
  },
  { public: true }
);

import { NextResponse } from "next/server";

import { withGoat } from "@/lib/goat/api";
import { buildGoatOpenApiSpec } from "@/lib/goat/openapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Serves the OpenAPI 3.1 contract for the Custom GPT Action. Public so GPT
// Builder can "Import from URL" — the spec itself contains no secrets.
export const GET = withGoat(
  "/api/goat/openapi",
  async (_req, _ctx) => NextResponse.json(buildGoatOpenApiSpec()),
  { public: true }
);

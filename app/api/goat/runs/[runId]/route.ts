import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { goatFail, goatOk, requireGoatAuth, goatLog, type GoatContext } from "@/lib/goat/api";
import { getGoatClient, goatDbFail } from "@/lib/goat/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// get_run_status — fetch one run by id. Dynamic segments need the params
// argument, so this route wires auth/logging directly instead of withGoat.
export async function GET(
  req: NextRequest,
  { params }: { params: { runId: string } }
): Promise<NextResponse> {
  const ctx: GoatContext = {
    requestId: crypto.randomUUID(),
    route: "/api/goat/runs/[runId]",
  };
  goatLog("info", ctx, "request_start", { method: "GET" });
  const denied = requireGoatAuth(req, ctx);
  if (denied) return denied;

  const idCheck = z.string().uuid().safeParse(params.runId);
  if (!idCheck.success) {
    return goatFail(ctx, 400, "bad_request", "run_id must be a UUID returned by plan/execute.");
  }
  const { db, fail } = getGoatClient(ctx);
  if (fail) return fail;

  try {
    const { data, error } = await db
      .from("goat_runs")
      .select("*")
      .eq("id", idCheck.data)
      .maybeSingle();
    if (error) return goatDbFail(ctx, error);
    if (!data) return goatFail(ctx, 404, "run_not_found", `No run with id ${idCheck.data}.`);
    const res = goatOk(ctx, { run: data });
    goatLog("info", ctx, "request_done", { status: 200 });
    return res;
  } catch (err) {
    goatLog("error", ctx, "unhandled_exception", {
      message: err instanceof Error ? err.message : String(err),
    });
    return goatFail(ctx, 500, "internal_error", "Unexpected server error.");
  }
}

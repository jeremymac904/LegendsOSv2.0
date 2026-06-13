import { z } from "zod";

import { goatFail, goatLog, goatOk, readJson, withGoat, zodMessage } from "@/lib/goat/api";
import { getGoatClient, goatDbFail } from "@/lib/goat/db";
import { buildPlan } from "@/lib/goat/planner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const executeSchema = z
  .object({
    run_id: z.string().uuid().optional(),
    goal: z.string().min(5).max(2000).optional(),
    mode: z.enum(["queue", "dry_run"]).default("queue"),
    notes: z.string().max(2000).optional(),
  })
  .refine((v) => Boolean(v.run_id) !== Boolean(v.goal), {
    message: "Provide exactly one of run_id (from plan_agent_task) or goal.",
  });

// execute_agent_task — turns a plan into an execution run. This API does not
// run code itself: 'queue' records a run for Claude Code / the chief
// integrator to pick up (visible in Supabase goat_runs), 'dry_run' completes
// immediately with the command pack so the GPT can show what WOULD happen.
export const POST = withGoat("/api/goat/agent/execute", async (req, ctx) => {
  const parsed = executeSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return goatFail(ctx, 400, "bad_request", zodMessage(parsed.error.issues));
  }
  const { db, fail } = getGoatClient(ctx);
  if (fail) return fail;
  const { run_id, goal, mode, notes } = parsed.data;

  let planRunId: string | null = null;
  let effectiveGoal: string;
  let plan: Record<string, unknown>;

  if (run_id) {
    const { data: planRun, error } = await db
      .from("goat_runs")
      .select("*")
      .eq("id", run_id)
      .maybeSingle();
    if (error) return goatDbFail(ctx, error);
    if (!planRun) {
      return goatFail(ctx, 404, "run_not_found", `No run with id ${run_id}.`);
    }
    if (planRun.kind !== "plan") {
      return goatFail(
        ctx,
        400,
        "not_a_plan",
        `Run ${run_id} is a '${planRun.kind}' run. Pass a run id returned by plan_agent_task.`
      );
    }
    planRunId = planRun.id;
    effectiveGoal = planRun.goal;
    plan = planRun.plan ?? {};
  } else {
    effectiveGoal = goal as string;
    plan = { ...buildPlan(effectiveGoal), context: null, constraints: [] };
  }

  const commandPack = {
    operator: "claude-code",
    instruction:
      "Pick up this run from goat_runs, execute the plan steps in order, then update status to running/completed/failed with a result summary.",
    goal: effectiveGoal,
    notes: notes ?? null,
  };

  const isDryRun = mode === "dry_run";
  const { data, error } = await db
    .from("goat_runs")
    .insert({
      kind: "execute",
      status: isDryRun ? "completed" : "queued",
      goal: effectiveGoal,
      parent_run_id: planRunId,
      plan,
      result: isDryRun
        ? {
            simulated: true,
            message: "Dry run — nothing was queued or executed.",
            command_pack: commandPack,
          }
        : {
            simulated: false,
            message:
              "Queued. Execution happens on Jeremy's side via Claude Code; poll get_run_status for updates.",
            command_pack: commandPack,
          },
    })
    .select()
    .single();
  if (error) return goatDbFail(ctx, error);

  goatLog("info", ctx, "execution_run_created", {
    run_id: data.id,
    mode,
    parent_run_id: planRunId,
  });
  return goatOk(ctx, { run: data }, { status: 201 });
});

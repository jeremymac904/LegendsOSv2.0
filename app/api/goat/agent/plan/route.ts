import { z } from "zod";

import { goatFail, goatLog, goatOk, readJson, withGoat, zodMessage } from "@/lib/goat/api";
import { getGoatClient, goatDbFail } from "@/lib/goat/db";
import { buildPlan } from "@/lib/goat/planner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const planSchema = z.object({
  goal: z.string().min(5, "goal must be at least 5 characters").max(2000),
  context: z.string().max(6000).optional(),
  constraints: z.array(z.string().min(1).max(300)).max(10).optional(),
});

// plan_agent_task — builds a deterministic plan and persists it as a run with
// status 'planned'. The returned run.id feeds execute_agent_task.
export const POST = withGoat("/api/goat/agent/plan", async (req, ctx) => {
  const parsed = planSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return goatFail(ctx, 400, "bad_request", zodMessage(parsed.error.issues));
  }
  const { db, fail } = getGoatClient(ctx);
  if (fail) return fail;

  const plan = buildPlan(parsed.data.goal, parsed.data.context, parsed.data.constraints);
  const { data, error } = await db
    .from("goat_runs")
    .insert({
      kind: "plan",
      status: "planned",
      goal: parsed.data.goal,
      plan: {
        ...plan,
        context: parsed.data.context ?? null,
        constraints: parsed.data.constraints ?? [],
      },
    })
    .select()
    .single();
  if (error) return goatDbFail(ctx, error);

  goatLog("info", ctx, "plan_created", { run_id: data.id, steps: plan.steps.length });
  return goatOk(ctx, { run: data }, { status: 201 });
});

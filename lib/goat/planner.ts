// GOAT Architect Command API — deterministic task planner.
// ---------------------------------------------------------------------------
// plan_agent_task does NOT call an LLM (the Custom GPT calling this API is
// the LLM). It produces a structured, reviewable execution plan that the
// execute endpoint turns into a queued run. Steps are derived from the goal
// text so the plan is stable and auditable.
// ---------------------------------------------------------------------------

export interface PlanStep {
  id: number;
  title: string;
  detail: string;
  kind: "discovery" | "design" | "implement" | "validate" | "ship";
}

export interface GoatPlan {
  summary: string;
  suggested_agent: string;
  estimated_complexity: "small" | "medium" | "large";
  steps: PlanStep[];
  risks: string[];
}

interface GoalSignals {
  api: boolean;
  ui: boolean;
  db: boolean;
  automation: boolean;
  content: boolean;
}

function readSignals(goal: string): GoalSignals {
  const g = goal.toLowerCase();
  return {
    api: /\b(api|endpoint|route|webhook|integration)\b/.test(g),
    ui: /\b(ui|page|screen|component|design|layout|dashboard)\b/.test(g),
    db: /\b(table|schema|database|supabase|migration|rls)\b/.test(g),
    automation: /\b(automation|workflow|n8n|cron|schedule|zapier)\b/.test(g),
    content: /\b(post|email|video|content|copy|newsletter|social)\b/.test(g),
  };
}

function suggestAgent(s: GoalSignals): string {
  if (s.content) return "marketing_agent";
  if (s.automation) return "builder_agent";
  if (s.ui) return "ux_agent";
  return "builder_agent";
}

export function buildPlan(goal: string, context?: string, constraints?: string[]): GoatPlan {
  const signals = readSignals(goal);
  const steps: PlanStep[] = [];
  let id = 1;

  steps.push({
    id: id++,
    title: "Confirm scope and current state",
    detail: `Restate the goal ("${goal.slice(0, 140)}") and inspect the affected surfaces before changing anything.${context ? " Context provided by caller is attached to the run." : ""}`,
    kind: "discovery",
  });
  if (signals.db) {
    steps.push({
      id: id++,
      title: "Design schema changes",
      detail: "Draft Supabase migration(s) with RLS, review against existing tables, apply to a branch first.",
      kind: "design",
    });
  }
  if (signals.api) {
    steps.push({
      id: id++,
      title: "Implement API surface",
      detail: "Add/modify route handlers under app/api with zod validation, auth, and structured logs.",
      kind: "implement",
    });
  }
  if (signals.ui) {
    steps.push({
      id: id++,
      title: "Implement UI changes",
      detail: "Build or adjust components/pages following the dark-gold-glass system; cover empty/loading states.",
      kind: "implement",
    });
  }
  if (signals.automation) {
    steps.push({
      id: id++,
      title: "Wire automation",
      detail: "Create/update n8n workflow or scheduled function; keep live sends behind owner toggles.",
      kind: "implement",
    });
  }
  if (steps.length === 1) {
    steps.push({
      id: id++,
      title: "Implement the change",
      detail: "Make the smallest correct change that satisfies the goal, following existing repo conventions.",
      kind: "implement",
    });
  }
  steps.push({
    id: id++,
    title: "Validate",
    detail: "Run typecheck, lint, build, and endpoint/UI smoke tests. Fix until green.",
    kind: "validate",
  });
  steps.push({
    id: id++,
    title: "Ship and verify live",
    detail: "Commit, push to main, wait for the Netlify deploy, verify on https://legendsos.app.",
    kind: "ship",
  });

  const implementCount = steps.filter((s) => s.kind === "implement" || s.kind === "design").length;
  const estimated_complexity: GoatPlan["estimated_complexity"] =
    implementCount <= 1 ? "small" : implementCount === 2 ? "medium" : "large";

  const risks: string[] = [
    "Production deploy goes through main — a broken build blocks the whole site.",
  ];
  if (signals.db) risks.push("Schema changes must keep RLS fail-closed; verify with get_advisors.");
  if (signals.automation) risks.push("Never enable live sends/publishes without Jeremy's owner toggle.");
  for (const c of constraints ?? []) risks.push(`Caller constraint: ${c}`);

  return {
    summary: `Plan for: ${goal.slice(0, 200)}`,
    suggested_agent: suggestAgent(signals),
    estimated_complexity,
    steps,
    risks,
  };
}

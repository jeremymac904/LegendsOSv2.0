// Builder workspace prompt + QA templates.
//
// These are the typed building blocks for Jeremy's owner-only build cockpit.
// The prompt builders are pure functions so they can be unit-tested and reused
// by the client workspace without pulling in any React. The checklists are
// tailored to THIS repo: a Next.js App Router app deployed on Netlify, backed
// by Supabase, shipped to desktop via electron-builder (mac + windows).

export interface ClaudeCodePromptInput {
  repoPath: string;
  goal: string;
  constraints: string;
}

export interface CodexReviewPromptInput {
  repoPath: string;
  goal: string;
  constraints: string;
}

/**
 * Builds a launch prompt for a fresh Claude Code agent. Designed to be pasted
 * directly into a terminal session so the agent has repo context, a crisp goal,
 * and the guardrails it must respect.
 */
export function CLAUDE_CODE_PROMPT_TEMPLATE({
  repoPath,
  goal,
  constraints,
}: ClaudeCodePromptInput): string {
  const repo = repoPath.trim() || "<repo path>";
  const objective = goal.trim() || "<describe the goal>";
  const rules = constraints.trim() || "Keep changes minimal, typed, and reversible.";

  return [
    "You are Claude Code working in the LegendsOS monorepo.",
    "",
    `REPO: ${repo}`,
    "",
    "GOAL:",
    objective,
    "",
    "CONSTRAINTS:",
    rules,
    "",
    "WORKING RULES:",
    "- Read before you write. Match existing conventions (App Router pages, the",
    "  card/chip/glass-card utility classes, lucide-react icons, the cn() helper).",
    "- Keep everything type-safe — explicit types, no implicit any.",
    "- Do not touch lib/navigation.ts unless the task explicitly says so.",
    "- Do not add npm dependencies or edit env/secret files.",
    "- Run npm run lint && npm run typecheck && npm run build before declaring done.",
    "",
    "DELIVERABLE:",
    "- A focused diff plus a one-paragraph summary of what changed and why,",
    "  and the exact files you created or edited (absolute paths).",
  ].join("\n");
}

/**
 * Builds a review prompt for Codex (or any second-opinion reviewer) to audit a
 * change set produced by Claude Code. Emphasizes correctness, type safety, and
 * the LegendsOS conventions rather than rewriting from scratch.
 */
export function CODEX_REVIEW_PROMPT_TEMPLATE({
  repoPath,
  goal,
  constraints,
}: CodexReviewPromptInput): string {
  const repo = repoPath.trim() || "<repo path>";
  const objective = goal.trim() || "<what the change was supposed to accomplish>";
  const rules = constraints.trim() || "Flag any regression risk, type holes, or convention drift.";

  return [
    "You are a senior reviewer auditing a change in the LegendsOS monorepo.",
    "",
    `REPO: ${repo}`,
    "",
    "WHAT THE CHANGE WAS SUPPOSED TO DO:",
    objective,
    "",
    "REVIEW FOCUS:",
    rules,
    "",
    "REVIEW CHECKLIST:",
    "- Correctness: does the diff actually accomplish the stated goal?",
    "- Type safety: any implicit any, unsafe casts, or non-null assertions?",
    "- Conventions: App Router page pattern, permission gates, utility classes,",
    "  lucide-react icons, cn() usage — all consistent with the surrounding code?",
    "- Security: no leaked secrets, no client-side trust of owner-only gates,",
    "  RLS still relied upon for data access.",
    "- Edge cases: empty states, loading states, error handling.",
    "- Footprint: no stray files, no unrelated churn, no new dependencies.",
    "",
    "OUTPUT:",
    "- A prioritized list of findings (blocker / should-fix / nit), each with the",
    "  file + line and a concrete suggested fix. End with an APPROVE or REQUEST",
    "  CHANGES verdict.",
  ].join("\n");
}

export const NETLIFY_QA_CHECKLIST: string[] = [
  "netlify.toml build command and publish dir match the Next.js App Router setup",
  "@netlify/plugin-nextjs is installed and active for the deploy",
  "Environment variables set in Netlify match .env.example (no secrets in repo)",
  "Production build passes: npm run build with no type or lint errors",
  "Server components marked dynamic = 'force-dynamic' where they read live data",
  "Redirects/rewrites in netlify.toml verified (auth, /dashboard fallbacks)",
  "Preview deploy URL loads the login flow and protected routes redirect correctly",
  "No client-only code leaking into server components (no window/document at build)",
  "Image domains / next.config remote patterns allowlisted for any external media",
  "Deploy logs are clean — no warnings about missing env or edge runtime conflicts",
];

export const SUPABASE_QA_CHECKLIST: string[] = [
  "RLS is ENABLED on every table touched by this change",
  "Policies cover select/insert/update/delete for each affected role",
  "Owner/admin gates are UI-only — confirm RLS independently enforces access",
  "Migrations in supabase/ apply cleanly from a fresh database",
  "Seed data in supabase/seeds/ is idempotent and safe to re-run",
  "Service-role key is only used server-side, never shipped to the client bundle",
  "@supabase/ssr cookie handling verified (session persists across navigation)",
  "Foreign keys + indexes exist for new columns used in joins or filters",
  "Generated types/database.ts regenerated and matches the live schema",
  "No N+1 query patterns introduced in server components or route handlers",
];

export const DESKTOP_BUILD_QA_CHECKLIST: string[] = [
  "npm run lint passes with zero errors",
  "npm run typecheck passes with zero errors",
  "npm run build (web) succeeds before packaging the desktop app",
  "electron-builder config has correct appId, product name, and icons",
  "npm run desktop:build:mac produces a signed/notarizable .dmg",
  "Windows target (nsis) build config present and produces an installer",
  "App boots offline-friendly — no hard crash when network is unavailable",
  "Auto-update channel / publish config reviewed (or intentionally disabled)",
  "App version in package.json bumped to match the release tag",
  "Smoke test the packaged app: login, navigation, and one core flow work",
];

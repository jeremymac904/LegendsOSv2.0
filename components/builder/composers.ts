// Pure prompt composers for the Builder workspace. Each takes plain inputs and
// returns a structured prompt string. No React, no side effects — easy to test
// by eye and reuse across panels.

function section(title: string, body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";
  return `## ${title}\n${trimmed}\n`;
}

function bulletList(raw: string): string {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => (l.startsWith("-") ? l : `- ${l}`))
    .join("\n");
}

export interface ImplementationPlanInput {
  projectName: string;
  goal: string;
  context: string;
  constraints: string;
  successCriteria: string;
}

export function composeImplementationPlan(i: ImplementationPlanInput): string {
  return [
    `# Implementation plan request${i.projectName ? `: ${i.projectName}` : ""}`,
    "",
    "Act as a senior engineer. Produce a concrete, step-by-step implementation plan I can hand to a coding agent. Number the steps, call out files to touch, edge cases, and a verification checklist at the end.",
    "",
    section("Goal", i.goal),
    section("Context", i.context),
    i.constraints.trim() ? section("Constraints", bulletList(i.constraints)) : "",
    i.successCriteria.trim()
      ? section("Success criteria", bulletList(i.successCriteria))
      : "",
    "## Deliverable",
    "A numbered plan with file-by-file changes, risks, and a final verification checklist.",
  ]
    .filter(Boolean)
    .join("\n");
}

export interface ClaudeHandoffInput {
  taskTitle: string;
  repoArea: string;
  whatToBuild: string;
  filesAllowed: string;
  acceptanceCriteria: string;
  doNot: string;
}

export function composeClaudeHandoff(i: ClaudeHandoffInput): string {
  return [
    `# Claude Code handoff${i.taskTitle ? `: ${i.taskTitle}` : ""}`,
    "",
    "You are an autonomous coding agent. Inspect before modifying; read each file fully first and match existing style. Produce code that compiles.",
    "",
    i.repoArea.trim() ? section("Repo area / stack", i.repoArea) : "",
    section("What to build", i.whatToBuild),
    i.filesAllowed.trim()
      ? section("Files you may create or edit", bulletList(i.filesAllowed))
      : "",
    i.acceptanceCriteria.trim()
      ? section("Acceptance criteria", bulletList(i.acceptanceCriteria))
      : "",
    i.doNot.trim() ? section("Do NOT", bulletList(i.doNot)) : "",
    "## Output",
    "Make the edits, then summarize the files changed and how you verified the work.",
  ]
    .filter(Boolean)
    .join("\n");
}

export interface CodexReviewInput {
  scope: string;
  diffOrFiles: string;
  focus: string;
}

export function composeCodexReview(i: CodexReviewInput): string {
  return [
    "# Code review request",
    "",
    "Act as a meticulous reviewer. Find correctness bugs first, then reuse / simplification / efficiency cleanups. For each finding give: file, severity, why it matters, and a concrete fix.",
    "",
    section("Scope", i.scope),
    section("Diff or files to review", i.diffOrFiles),
    i.focus.trim() ? section("Focus areas", bulletList(i.focus)) : "",
    "## Output",
    "Grouped findings (Bugs, then Cleanups) with severity labels and suggested patches.",
  ]
    .filter(Boolean)
    .join("\n");
}

export type QaTarget = "netlify" | "supabase" | "desktop";

const QA_PRESETS: Record<
  QaTarget,
  { title: string; checklist: string[] }
> = {
  netlify: {
    title: "Netlify deploy QA",
    checklist: [
      "Production build succeeds with no type or lint errors",
      "Root path returns the expected redirect / status for unauthenticated users",
      "Each primary route renders without a Server Components / hydration error",
      "Environment variables required at build + runtime are present (names only)",
      "Redirects and headers in netlify.toml behave as intended",
      "No console errors on first paint of the deployed site",
    ],
  },
  supabase: {
    title: "Supabase QA",
    checklist: [
      "RLS policies enforce per-user / per-role access on every touched table",
      "Migrations apply cleanly with no drift against the live schema",
      "Service-role usage is server-only and never reaches the client bundle",
      "Storage bucket policies match the intended visibility",
      "Auth session refresh works and expired sessions degrade gracefully",
      "No secrets are logged or returned to the client",
    ],
  },
  desktop: {
    title: "Desktop app QA",
    checklist: [
      "App launches and the single-instance lock behaves correctly",
      "The hosted URL loads and reflects the latest web deploy",
      "Screen / window capture and file attach work where supported",
      "External links open in the system browser, not inside the shell",
      "Auto-update / version display is accurate",
      "App quits cleanly with no orphaned processes",
    ],
  },
};

export interface QaInput {
  target: QaTarget;
  context: string;
  extraChecks: string;
}

export function composeQaChecklist(i: QaInput): string {
  const preset = QA_PRESETS[i.target];
  const base = preset.checklist.map((c) => `- [ ] ${c}`).join("\n");
  const extra = i.extraChecks.trim()
    ? "\n" +
      i.extraChecks
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => `- [ ] ${l.replace(/^-\s*\[?\s?\]?\s*/, "")}`)
        .join("\n")
    : "";
  return [
    `# ${preset.title} checklist`,
    "",
    "Run this QA pass and report each item as pass / fail with evidence. Flag anything you cannot verify rather than assuming it passes.",
    "",
    i.context.trim() ? section("Context", i.context) : "",
    "## Checklist",
    base + extra,
    "",
    "## Output",
    "A pass/fail table plus a short summary of any blockers found.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function qaTitle(target: QaTarget): string {
  return QA_PRESETS[target].title;
}

export interface IncubatorInput {
  idea: string;
  audience: string;
  problem: string;
}

export function composeIncubator(i: IncubatorInput): string {
  return [
    "# Product incubator brief",
    "",
    "Act as a product strategist. Pressure-test this idea and return: a sharp one-line pitch, the core user + job-to-be-done, an MVP feature list, the riskiest assumption, and a 3-step validation plan.",
    "",
    section("Idea", i.idea),
    i.audience.trim() ? section("Target audience", i.audience) : "",
    i.problem.trim() ? section("Problem it solves", i.problem) : "",
    "## Output",
    "Pitch, user/JTBD, MVP scope, riskiest assumption, and a validation plan.",
  ]
    .filter(Boolean)
    .join("\n");
}

export type WebsiteKind = "website" | "blog";

export interface WebsiteInput {
  kind: WebsiteKind;
  topic: string;
  audience: string;
  tone: string;
  sectionsOrOutline: string;
  cta: string;
}

export function composeWebsite(i: WebsiteInput): string {
  const isBlog = i.kind === "blog";
  return [
    `# ${isBlog ? "Blog post" : "Website / landing page"} build request`,
    "",
    isBlog
      ? "Act as a content writer + SEO strategist. Draft a complete, well-structured blog post with a compelling title, intro hook, scannable headings, and a closing CTA."
      : "Act as a conversion-focused web copywriter + front-end planner. Produce section-by-section page copy and a layout outline ready to build.",
    "",
    section(isBlog ? "Topic" : "Page topic / offer", i.topic),
    i.audience.trim() ? section("Audience", i.audience) : "",
    i.tone.trim() ? section("Tone / voice", i.tone) : "",
    i.sectionsOrOutline.trim()
      ? section(isBlog ? "Outline / key points" : "Sections to include", bulletList(i.sectionsOrOutline))
      : "",
    i.cta.trim() ? section("Call to action", i.cta) : "",
    "## Output",
    isBlog
      ? "Title, meta description, and the full post body in Markdown."
      : "Section-by-section copy plus a layout outline and component notes.",
  ]
    .filter(Boolean)
    .join("\n");
}

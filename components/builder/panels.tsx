"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Video } from "lucide-react";

import { cn, formatRelative } from "@/lib/utils";

import {
  composeClaudeHandoff,
  composeCodexReview,
  composeImplementationPlan,
  composeIncubator,
  composeQaChecklist,
  composeWebsite,
  qaTitle,
  type QaTarget,
  type WebsiteKind,
} from "./composers";
import {
  CopyButton,
  Field,
  newId,
  PromptPreview,
  SendToAtlasButton,
  TextArea,
  TextInput,
  useLocalStorageList,
  type BuilderProject,
  type PromptHistoryEntry,
  BUILDER_HISTORY_KEY,
  BUILDER_PROJECTS_KEY,
} from "./builderShared";

// Shared record signature so any panel can log a composed prompt to history.
export type RecordPrompt = (
  entry: Omit<PromptHistoryEntry, "id" | "createdAt">,
) => void;

// A reusable composer footer: Copy (always real) + Send to Atlas, both record
// to build-log history when they fire.
function ComposerActions({
  kind,
  title,
  getText,
  record,
  disabled,
}: {
  kind: string;
  title: string;
  getText: () => string;
  record: RecordPrompt;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <SendToAtlasButton
        getText={getText}
        disabled={disabled}
        onSent={() =>
          record({ kind, title, prompt: getText(), action: "sent-to-atlas" })
        }
      />
      <CopyButton
        getText={getText}
        disabled={disabled}
        onCopied={() =>
          record({ kind, title, prompt: getText(), action: "copied" })
        }
      />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// 1. Project workspace manager (localStorage — real persistence)
// ───────────────────────────────────────────────────────────────────────────

export function ProjectsPanel() {
  const { items, add, remove, persist, hydrated } =
    useLocalStorageList<BuilderProject>(BUILDER_PROJECTS_KEY);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");

  function create() {
    if (!name.trim()) return;
    add({
      id: newId(),
      name: name.trim(),
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    });
    setName("");
    setNotes("");
  }

  return (
    <div className="space-y-4">
      <div className="card-padded space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Project name">
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Builder route, Vibe Coding studio"
              onKeyDown={(e) => {
                if (e.key === "Enter") create();
              }}
            />
          </Field>
          <Field label="Notes" hint="What is this project for?">
            <TextInput
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="One-line description"
            />
          </Field>
        </div>
        <button
          type="button"
          onClick={create}
          disabled={!name.trim()}
          className="btn-primary"
        >
          <Plus size={14} />
          Add project
        </button>
      </div>

      <div className="space-y-2">
        {!hydrated ? (
          <p className="text-xs text-ink-600 dark:text-ink-400">Loading…</p>
        ) : items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink-200 dark:border-ink-700 bg-white/40 dark:bg-ink-900/30 px-4 py-6 text-center text-xs text-ink-600 dark:text-ink-400">
            No projects yet. Add one above — entries are saved locally in this
            browser.
          </p>
        ) : (
          items.map((p, idx) => (
            <div
              key={p.id}
              className="card-padded flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-900 dark:text-ink-100">
                  {p.name}
                </p>
                {p.notes && (
                  <p className="mt-0.5 text-xs text-ink-700 dark:text-ink-300">
                    {p.notes}
                  </p>
                )}
                <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-ink-600 dark:text-ink-400">
                  Added {formatRelative(p.createdAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  title="Move up"
                  disabled={idx === 0}
                  onClick={() => {
                    const next = [...items];
                    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                    persist(next);
                  }}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-ink-200 dark:border-ink-800 text-ink-600 dark:text-ink-300 transition hover:border-accent-gold/40 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  title="Remove project"
                  onClick={() => remove(p.id)}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-ink-200 dark:border-ink-800 text-ink-600 dark:text-ink-300 transition hover:border-status-err/40 hover:text-status-err"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// 2. Record review / screen recording / transcription (honest disabled state)
// ───────────────────────────────────────────────────────────────────────────

export function RecordReviewPanel({ record }: { record: RecordPrompt }) {
  const [notes, setNotes] = useState("");
  const text = useMemo(
    () =>
      notes.trim()
        ? `# Record review\n\nReview the following session notes and turn them into an action list with owners and next steps.\n\n## Notes\n${notes.trim()}`
        : "",
    [notes],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          {
            title: "Screen recording upload",
            body: "Drag-and-drop screen recordings for review. Storage + playback wiring is not connected yet.",
          },
          {
            title: "Auto transcription",
            body: "Transcribe uploaded recordings into searchable text. The transcription provider is not wired yet.",
          },
        ].map((c) => (
          <div
            key={c.title}
            className="rounded-xl border border-dashed border-ink-200 dark:border-ink-700 bg-white/40 dark:bg-ink-900/30 p-4"
          >
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-ink-200 dark:border-ink-800 bg-ink-100/60 dark:bg-ink-950/50 text-ink-600 dark:text-ink-400">
                <Video size={15} />
              </span>
              <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">
                {c.title}
              </p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-ink-700 dark:text-ink-300">
              {c.body}
            </p>
            <button
              type="button"
              disabled
              className="mt-3 inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-ink-200 dark:border-ink-800 bg-ink-100/60 dark:bg-ink-950/40 px-3 py-1.5 text-[11px] font-medium text-ink-600 dark:text-ink-400"
              title="Not yet wired"
            >
              Coming soon — not yet wired
            </button>
          </div>
        ))}
      </div>

      <div className="card-padded space-y-3">
        <p className="text-xs text-ink-700 dark:text-ink-300">
          In the meantime, paste your own notes from a recording or review
          session and turn them into an action list.
        </p>
        <Field label="Session notes">
          <TextArea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Paste meeting / recording notes here…"
          />
        </Field>
        <PromptPreview text={text} />
        <ComposerActions
          kind="Record review"
          title="Record review → action list"
          getText={() => text}
          record={record}
          disabled={!text.trim()}
        />
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// 3. Implementation plan generator
// ───────────────────────────────────────────────────────────────────────────

export function ImplementationPlanPanel({ record }: { record: RecordPrompt }) {
  const [projectName, setProjectName] = useState("");
  const [goal, setGoal] = useState("");
  const [context, setContext] = useState("");
  const [constraints, setConstraints] = useState("");
  const [successCriteria, setSuccessCriteria] = useState("");

  const text = useMemo(
    () =>
      goal.trim()
        ? composeImplementationPlan({
            projectName,
            goal,
            context,
            constraints,
            successCriteria,
          })
        : "",
    [projectName, goal, context, constraints, successCriteria],
  );

  return (
    <div className="card-padded space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Project name">
          <TextInput
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="optional"
          />
        </Field>
        <Field label="Goal" hint="What outcome do you want?">
          <TextInput
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. Add an owner-only Builder workspace"
          />
        </Field>
      </div>
      <Field label="Context">
        <TextArea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Stack, current state, relevant files…"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Constraints" hint="One per line">
          <TextArea
            value={constraints}
            onChange={(e) => setConstraints(e.target.value)}
            placeholder="No new deps&#10;Must compile (Next 14, strict TS)"
          />
        </Field>
        <Field label="Success criteria" hint="One per line">
          <TextArea
            value={successCriteria}
            onChange={(e) => setSuccessCriteria(e.target.value)}
            placeholder="Page is owner-gated&#10;Every action is real or honestly disabled"
          />
        </Field>
      </div>
      <PromptPreview text={text} />
      <ComposerActions
        kind="Implementation plan"
        title={projectName ? `Plan: ${projectName}` : "Implementation plan"}
        getText={() => text}
        record={record}
        disabled={!text.trim()}
      />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// 4. Claude Code handoff builder
// ───────────────────────────────────────────────────────────────────────────

export function ClaudeHandoffPanel({ record }: { record: RecordPrompt }) {
  const [taskTitle, setTaskTitle] = useState("");
  const [repoArea, setRepoArea] = useState("");
  const [whatToBuild, setWhatToBuild] = useState("");
  const [filesAllowed, setFilesAllowed] = useState("");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState("");
  const [doNot, setDoNot] = useState("");

  const text = useMemo(
    () =>
      whatToBuild.trim()
        ? composeClaudeHandoff({
            taskTitle,
            repoArea,
            whatToBuild,
            filesAllowed,
            acceptanceCriteria,
            doNot,
          })
        : "",
    [taskTitle, repoArea, whatToBuild, filesAllowed, acceptanceCriteria, doNot],
  );

  return (
    <div className="card-padded space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Task title">
          <TextInput
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            placeholder="e.g. Build the Vibe Coding studio"
          />
        </Field>
        <Field label="Repo area / stack">
          <TextInput
            value={repoArea}
            onChange={(e) => setRepoArea(e.target.value)}
            placeholder="Next 14 App Router, React 18, strict TS"
          />
        </Field>
      </div>
      <Field label="What to build">
        <TextArea
          value={whatToBuild}
          onChange={(e) => setWhatToBuild(e.target.value)}
          placeholder="Describe the feature in detail…"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Files allowed" hint="One per line">
          <TextArea
            value={filesAllowed}
            onChange={(e) => setFilesAllowed(e.target.value)}
            placeholder="app/(app)/vibe-coding/page.tsx&#10;components/vibe/**"
          />
        </Field>
        <Field label="Acceptance criteria" hint="One per line">
          <TextArea
            value={acceptanceCriteria}
            onChange={(e) => setAcceptanceCriteria(e.target.value)}
            placeholder="Compiles&#10;On-theme (light spec)&#10;No dead buttons"
          />
        </Field>
      </div>
      <Field label="Do NOT" hint="One per line — guardrails">
        <TextArea
          value={doNot}
          onChange={(e) => setDoNot(e.target.value)}
          placeholder="Edit other lanes' files&#10;Add npm deps&#10;Push or deploy"
        />
      </Field>
      <PromptPreview text={text} />
      <ComposerActions
        kind="Claude Code handoff"
        title={taskTitle ? `Handoff: ${taskTitle}` : "Claude Code handoff"}
        getText={() => text}
        record={record}
        disabled={!text.trim()}
      />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// 5. Codex review prompt builder (copy only)
// ───────────────────────────────────────────────────────────────────────────

export function CodexReviewPanel({ record }: { record: RecordPrompt }) {
  const [scope, setScope] = useState("");
  const [diffOrFiles, setDiffOrFiles] = useState("");
  const [focus, setFocus] = useState("");

  const text = useMemo(
    () =>
      scope.trim() || diffOrFiles.trim()
        ? composeCodexReview({ scope, diffOrFiles, focus })
        : "",
    [scope, diffOrFiles, focus],
  );

  return (
    <div className="card-padded space-y-3">
      <Field label="Scope" hint="What changed / what to review">
        <TextInput
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          placeholder="e.g. The new Builder workspace components"
        />
      </Field>
      <Field label="Diff or files to review">
        <TextArea
          value={diffOrFiles}
          onChange={(e) => setDiffOrFiles(e.target.value)}
          placeholder="Paste a diff, file list, or code snippets…"
          className="min-h-[140px] font-mono text-[11px]"
        />
      </Field>
      <Field label="Focus areas" hint="One per line (optional)">
        <TextArea
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          placeholder="Correctness&#10;Light-mode contrast&#10;Honest disabled states"
        />
      </Field>
      <PromptPreview text={text} />
      <div className="flex flex-wrap gap-2">
        <CopyButton
          getText={() => text}
          disabled={!text.trim()}
          label="Copy review prompt"
          onCopied={() =>
            record({
              kind: "Codex review",
              title: scope ? `Review: ${scope}` : "Codex review prompt",
              prompt: text,
              action: "copied",
            })
          }
        />
        <span className="self-center text-[10.5px] text-ink-600 dark:text-ink-400">
          Copy this into Codex / your reviewer of choice.
        </span>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// 6. QA prompt builders (Netlify / Supabase / Desktop)
// ───────────────────────────────────────────────────────────────────────────

export function QaPanel({ record }: { record: RecordPrompt }) {
  const [target, setTarget] = useState<QaTarget>("netlify");
  const [context, setContext] = useState("");
  const [extraChecks, setExtraChecks] = useState("");

  const text = useMemo(
    () => composeQaChecklist({ target, context, extraChecks }),
    [target, context, extraChecks],
  );

  const targets: { id: QaTarget; label: string }[] = [
    { id: "netlify", label: "Netlify" },
    { id: "supabase", label: "Supabase" },
    { id: "desktop", label: "Desktop app" },
  ];

  return (
    <div className="card-padded space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-[0.18em] text-ink-600 dark:text-ink-400">
          Target
        </span>
        {targets.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTarget(t.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-[11px] font-medium transition",
              target === t.id
                ? "border-accent-gold/50 bg-accent-gold/10 text-accent-gold"
                : "border-ink-200 dark:border-ink-800 bg-white/40 dark:bg-ink-900/40 text-ink-700 dark:text-ink-300 hover:border-accent-gold/30",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <Field label="Context" hint="What deploy / branch / build is this?">
        <TextInput
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="e.g. main branch production deploy"
        />
      </Field>
      <Field label="Extra checks" hint="One per line (optional)">
        <TextArea
          value={extraChecks}
          onChange={(e) => setExtraChecks(e.target.value)}
          placeholder="Verify the Builder route is owner-gated&#10;Vibe Coding renders for LO role"
        />
      </Field>
      <PromptPreview text={text} />
      <ComposerActions
        kind="QA checklist"
        title={qaTitle(target)}
        getText={() => text}
        record={record}
        disabled={!text.trim()}
      />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// 7. Personal product incubator
// ───────────────────────────────────────────────────────────────────────────

export function IncubatorPanel({ record }: { record: RecordPrompt }) {
  const [idea, setIdea] = useState("");
  const [audience, setAudience] = useState("");
  const [problem, setProblem] = useState("");

  const text = useMemo(
    () => (idea.trim() ? composeIncubator({ idea, audience, problem }) : ""),
    [idea, audience, problem],
  );

  return (
    <div className="card-padded space-y-3">
      <Field label="Idea">
        <TextArea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="Describe the product idea in a sentence or two…"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Target audience">
          <TextInput
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="Who is it for?"
          />
        </Field>
        <Field label="Problem it solves">
          <TextInput
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            placeholder="What pain does it remove?"
          />
        </Field>
      </div>
      <PromptPreview text={text} />
      <ComposerActions
        kind="Product incubator"
        title="Product incubator brief"
        getText={() => text}
        record={record}
        disabled={!text.trim()}
      />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// 8. Website & blog builder
// ───────────────────────────────────────────────────────────────────────────

export function WebsitePanel({ record }: { record: RecordPrompt }) {
  const [kind, setKind] = useState<WebsiteKind>("website");
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("");
  const [sectionsOrOutline, setSectionsOrOutline] = useState("");
  const [cta, setCta] = useState("");

  const text = useMemo(
    () =>
      topic.trim()
        ? composeWebsite({ kind, topic, audience, tone, sectionsOrOutline, cta })
        : "",
    [kind, topic, audience, tone, sectionsOrOutline, cta],
  );

  return (
    <div className="card-padded space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-[0.18em] text-ink-600 dark:text-ink-400">
          Type
        </span>
        {(["website", "blog"] as WebsiteKind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={cn(
              "rounded-full border px-3 py-1 text-[11px] font-medium capitalize transition",
              kind === k
                ? "border-accent-gold/50 bg-accent-gold/10 text-accent-gold"
                : "border-ink-200 dark:border-ink-800 bg-white/40 dark:bg-ink-900/40 text-ink-700 dark:text-ink-300 hover:border-accent-gold/30",
            )}
          >
            {k === "website" ? "Website / landing" : "Blog post"}
          </button>
        ))}
      </div>
      <Field label={kind === "blog" ? "Topic" : "Page topic / offer"}>
        <TextInput
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={
            kind === "blog"
              ? "e.g. First-time homebuyer FHA guide"
              : "e.g. Mortgage pre-approval landing page"
          }
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Audience">
          <TextInput
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="Who is reading?"
          />
        </Field>
        <Field label="Tone / voice">
          <TextInput
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            placeholder="e.g. warm, expert, concise"
          />
        </Field>
      </div>
      <Field
        label={kind === "blog" ? "Outline / key points" : "Sections to include"}
        hint="One per line"
      >
        <TextArea
          value={sectionsOrOutline}
          onChange={(e) => setSectionsOrOutline(e.target.value)}
          placeholder={
            kind === "blog"
              ? "What is FHA&#10;Down payment&#10;Credit requirements"
              : "Hero&#10;Benefits&#10;Social proof&#10;FAQ"
          }
        />
      </Field>
      <Field label="Call to action">
        <TextInput
          value={cta}
          onChange={(e) => setCta(e.target.value)}
          placeholder="e.g. Book a free pre-approval call"
        />
      </Field>
      <PromptPreview text={text} />
      <ComposerActions
        kind={kind === "blog" ? "Blog builder" : "Website builder"}
        title={topic ? `${kind === "blog" ? "Blog" : "Page"}: ${topic}` : "Website / blog"}
        getText={() => text}
        record={record}
        disabled={!text.trim()}
      />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// 9. Build logs + prompt history (localStorage — real)
// ───────────────────────────────────────────────────────────────────────────

export function HistoryPanel() {
  const { items, remove, clear, hydrated } =
    useLocalStorageList<PromptHistoryEntry>(BUILDER_HISTORY_KEY);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-ink-700 dark:text-ink-300">
          Every prompt you copy or send to Atlas is logged here and persists in
          this browser.
        </p>
        {items.length > 0 && (
          <button
            type="button"
            onClick={clear}
            className="btn-ghost text-xs text-status-err"
          >
            <Trash2 size={13} />
            Clear all
          </button>
        )}
      </div>
      {!hydrated ? (
        <p className="text-xs text-ink-600 dark:text-ink-400">Loading…</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-200 dark:border-ink-700 bg-white/40 dark:bg-ink-900/30 px-4 py-6 text-center text-xs text-ink-600 dark:text-ink-400">
          No prompts logged yet. Compose a prompt in any panel and copy or send
          it — it will show up here.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((h) => (
            <li key={h.id} className="card-padded">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-accent-gold/30 bg-accent-gold/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-accent-gold">
                      {h.kind}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                        h.action === "sent-to-atlas"
                          ? "bg-status-ok/15 text-status-ok"
                          : "bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-300",
                      )}
                    >
                      {h.action === "sent-to-atlas" ? "Sent to Atlas" : "Copied"}
                    </span>
                    <span className="text-[10px] text-ink-600 dark:text-ink-400">
                      {formatRelative(h.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm font-medium text-ink-900 dark:text-ink-100">
                    {h.title}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <CopyButton
                    getText={() => h.prompt}
                    label="Copy"
                    className="h-7 px-2 text-[11px]"
                  />
                  <button
                    type="button"
                    title="Remove from history"
                    onClick={() => remove(h.id)}
                    className="grid h-7 w-7 place-items-center rounded-lg border border-ink-200 dark:border-ink-800 text-ink-600 dark:text-ink-300 transition hover:border-status-err/40 hover:text-status-err"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] text-ink-600 dark:text-ink-400 hover:text-ink-900 dark:hover:text-ink-100">
                  View prompt
                </summary>
                <PromptPreview text={h.prompt} />
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

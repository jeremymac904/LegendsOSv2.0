"use client";

import { useMemo, useState } from "react";
import {
  Bot,
  Check,
  CheckSquare,
  ClipboardCheck,
  Copy,
  FileText,
  FolderKanban,
  Lightbulb,
  ListTodo,
  Mic,
  Plus,
  Rocket,
  ScrollText,
  Sparkles,
  Square,
  Terminal,
  Upload,
  Video,
  Wand2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import {
  CLAUDE_CODE_PROMPT_TEMPLATE,
  CODEX_REVIEW_PROMPT_TEMPLATE,
  DESKTOP_BUILD_QA_CHECKLIST,
  NETLIFY_QA_CHECKLIST,
  SUPABASE_QA_CHECKLIST,
} from "@/lib/builder/templates";

type TabKey = "projects" | "capture" | "plan" | "handoffs" | "qa" | "incubator";

interface TabDef {
  key: TabKey;
  label: string;
  icon: LucideIcon;
}

const TABS: TabDef[] = [
  { key: "projects", label: "Projects", icon: FolderKanban },
  { key: "capture", label: "Capture", icon: Video },
  { key: "plan", label: "Plan", icon: Wand2 },
  { key: "handoffs", label: "Handoffs", icon: Bot },
  { key: "qa", label: "QA", icon: ClipboardCheck },
  { key: "incubator", label: "Incubator", icon: Lightbulb },
];

type ProjectStatus = "active" | "paused" | "shipped";

interface BuildProject {
  id: string;
  name: string;
  status: ProjectStatus;
  notes: string;
}

interface IdeaCard {
  id: string;
  title: string;
  pitch: string;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

const STATUS_CHIP: Record<ProjectStatus, string> = {
  active: "chip-ok",
  paused: "chip-warn",
  shipped: "chip-info",
};

// ---------------------------------------------------------------------------
// Shared small UI pieces
// ---------------------------------------------------------------------------

function CardTitle({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
}) {
  return (
    <div className="mb-3 flex items-start gap-3">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-accent-gold/25 bg-ink-900/60 text-accent-gold">
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-[14px] font-semibold tracking-tight text-ink-100">
          {title}
        </p>
        {hint && (
          <p className="mt-0.5 text-[12px] leading-relaxed text-ink-400">{hint}</p>
        )}
      </div>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" onClick={handleCopy} className="btn-secondary gap-2">
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Projects tab
// ---------------------------------------------------------------------------

function ProjectsTab() {
  const [projects, setProjects] = useState<BuildProject[]>([
    {
      id: uid(),
      name: "LegendsOS v2",
      status: "active",
      notes: "Owner cockpit, Atlas, Loan Brain, desktop build. Primary focus.",
    },
    {
      id: uid(),
      name: "Personal incubator",
      status: "paused",
      notes: "Side products + website/blog experiments to validate quickly.",
    },
  ]);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("active");
  const [notes, setNotes] = useState("");

  function addProject(): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    setProjects((prev) => [
      { id: uid(), name: trimmed, status, notes: notes.trim() },
      ...prev,
    ]);
    setName("");
    setStatus("active");
    setNotes("");
  }

  function removeProject(id: string): void {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="space-y-5">
      <div className="card-padded">
        <CardTitle
          icon={Plus}
          title="New build project"
          hint="Lightweight, local-only project tracker. Nothing leaves the browser."
        />
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
            className="rounded-lg border border-ink-200 bg-white/70 px-3 py-2 text-[13px] text-ink-900 placeholder:text-ink-400 outline-none focus:border-accent-gold/50 dark:border-ink-800 dark:bg-ink-900/70 dark:text-ink-100"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ProjectStatus)}
            className="rounded-lg border border-ink-200 bg-white/70 px-3 py-2 text-[13px] text-ink-900 outline-none focus:border-accent-gold/50 dark:border-ink-800 dark:bg-ink-900/70 dark:text-ink-100"
          >
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="shipped">Shipped</option>
          </select>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          rows={2}
          className="mt-3 w-full rounded-lg border border-ink-200 bg-white/70 px-3 py-2 text-[13px] text-ink-900 placeholder:text-ink-400 outline-none focus:border-accent-gold/50 dark:border-ink-800 dark:bg-ink-900/70 dark:text-ink-100"
        />
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={addProject}
            disabled={!name.trim()}
            className="btn-primary gap-2 disabled:opacity-40"
          >
            <Plus size={14} />
            Add project
          </button>
        </div>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Add your first build project above to start tracking it."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {projects.map((project) => (
            <div key={project.id} className="card-padded">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[14px] font-semibold tracking-tight text-ink-100">
                  {project.name}
                </p>
                <span className={STATUS_CHIP[project.status]}>
                  {project.status}
                </span>
              </div>
              {project.notes && (
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink-300">
                  {project.notes}
                </p>
              )}
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => removeProject(project.id)}
                  className="text-[11px] uppercase tracking-wide text-ink-400 hover:text-status-err"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Capture tab
// ---------------------------------------------------------------------------

function CaptureTab() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card-padded">
        <CardTitle
          icon={Mic}
          title="Record review"
          hint="Talk through a build decision and review it later."
        />
        <p className="text-[12.5px] leading-relaxed text-ink-300">
          A guided audio review will let you narrate what you built, why, and what
          is left — then attach it to a project for context.
        </p>
        <span className="chip-off mt-3 inline-flex">Coming soon</span>
      </div>

      <div className="card-padded">
        <CardTitle
          icon={Upload}
          title="Screen recording upload"
          hint="Drop a screen capture of a session."
        />
        <div className="mt-1 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-ink-300/60 bg-ink-900/30 px-4 py-8 text-center dark:border-ink-700/60">
          <Video size={20} className="text-ink-400" />
          <p className="text-[12.5px] text-ink-300">
            Drag &amp; drop a recording here
          </p>
          <button
            type="button"
            disabled
            className="btn-secondary mt-1 cursor-not-allowed opacity-50"
          >
            Choose file
          </button>
          <span className="chip-off mt-1 inline-flex">Coming soon</span>
        </div>
      </div>

      <div className="card-padded lg:col-span-2">
        <CardTitle
          icon={FileText}
          title="Transcription"
          hint="Auto-transcribe recordings into searchable build notes."
        />
        <p className="text-[12.5px] leading-relaxed text-ink-300">
          Once a recording is uploaded, transcription will produce a clean
          transcript you can paste straight into the Plan tab to draft an
          implementation plan.
        </p>
        <span className="chip-off mt-3 inline-flex">Coming soon</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plan tab
// ---------------------------------------------------------------------------

function PlanTab() {
  const [notes, setNotes] = useState("");
  const [promptHistory, setPromptHistory] = useState<string[]>([]);
  const [logs, setLogs] = useState<string[]>([
    "workspace initialized",
    "ready — paste notes to draft a plan",
  ]);

  function savePrompt(): void {
    const trimmed = notes.trim();
    if (!trimmed) return;
    setPromptHistory((prev) => [trimmed, ...prev].slice(0, 12));
    setLogs((prev) =>
      [`saved prompt (${trimmed.length} chars)`, ...prev].slice(0, 30),
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card-padded lg:col-span-2">
        <CardTitle
          icon={Wand2}
          title="Implementation plan generator"
          hint="Paste raw notes or a transcript — Atlas will draft a phased plan."
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={6}
          placeholder="Paste build notes, a transcript, or a rough idea…"
          className="w-full rounded-lg border border-ink-200 bg-white/70 px-3 py-2 text-[13px] leading-relaxed text-ink-900 placeholder:text-ink-400 outline-none focus:border-accent-gold/50 dark:border-ink-800 dark:bg-ink-900/70 dark:text-ink-100"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11.5px] text-ink-400">
            Generation will call Atlas to turn notes into a phased plan. Wired up
            soon — for now you can save the prompt to history.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={savePrompt}
              disabled={!notes.trim()}
              className="btn-secondary gap-2 disabled:opacity-40"
            >
              <Plus size={14} />
              Save to history
            </button>
            <button
              type="button"
              disabled
              className="btn-primary cursor-not-allowed gap-2 opacity-50"
            >
              <Sparkles size={14} />
              Generate plan
            </button>
          </div>
        </div>
      </div>

      <div className="card-padded">
        <CardTitle
          icon={ListTodo}
          title="Prompt history"
          hint="Recently saved planning prompts."
        />
        {promptHistory.length === 0 ? (
          <p className="text-[12.5px] text-ink-400">No prompts saved yet.</p>
        ) : (
          <ul className="space-y-2">
            {promptHistory.map((p, i) => (
              <li
                key={`${i}-${p.slice(0, 8)}`}
                className="rounded-lg border border-ink-200/70 bg-ink-900/30 px-3 py-2 text-[12px] leading-relaxed text-ink-300 dark:border-ink-800/70"
              >
                {p.length > 160 ? `${p.slice(0, 160)}…` : p}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card-padded">
        <CardTitle
          icon={ScrollText}
          title="Build logs"
          hint="Session activity in this workspace."
        />
        <div className="scrollbar-thin max-h-56 overflow-y-auto rounded-lg border border-ink-200/70 bg-ink-950/60 p-3 font-mono text-[11.5px] leading-relaxed text-ink-300 dark:border-ink-800/70">
          {logs.map((line, i) => (
            <div key={`${i}-${line.slice(0, 6)}`} className="flex gap-2">
              <span className="text-accent-gold/70">›</span>
              <span>{line}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Handoffs tab
// ---------------------------------------------------------------------------

function PromptBuilder({
  icon,
  title,
  hint,
  build,
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
  build: (input: { repoPath: string; goal: string; constraints: string }) => string;
}) {
  const [repoPath, setRepoPath] = useState("");
  const [goal, setGoal] = useState("");
  const [constraints, setConstraints] = useState("");

  const prompt = useMemo(
    () => build({ repoPath, goal, constraints }),
    [build, repoPath, goal, constraints],
  );

  return (
    <div className="card-padded">
      <CardTitle icon={icon} title={title} hint={hint} />
      <div className="space-y-3">
        <input
          value={repoPath}
          onChange={(e) => setRepoPath(e.target.value)}
          placeholder="Repo path (e.g. ~/legendsos/legendsos-v2)"
          className="w-full rounded-lg border border-ink-200 bg-white/70 px-3 py-2 text-[13px] text-ink-900 placeholder:text-ink-400 outline-none focus:border-accent-gold/50 dark:border-ink-800 dark:bg-ink-900/70 dark:text-ink-100"
        />
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={2}
          placeholder="Goal"
          className="w-full rounded-lg border border-ink-200 bg-white/70 px-3 py-2 text-[13px] text-ink-900 placeholder:text-ink-400 outline-none focus:border-accent-gold/50 dark:border-ink-800 dark:bg-ink-900/70 dark:text-ink-100"
        />
        <textarea
          value={constraints}
          onChange={(e) => setConstraints(e.target.value)}
          rows={2}
          placeholder="Constraints"
          className="w-full rounded-lg border border-ink-200 bg-white/70 px-3 py-2 text-[13px] text-ink-900 placeholder:text-ink-400 outline-none focus:border-accent-gold/50 dark:border-ink-800 dark:bg-ink-900/70 dark:text-ink-100"
        />
      </div>
      <div className="mt-3">
        <div className="scrollbar-thin max-h-64 overflow-y-auto rounded-lg border border-ink-200/70 bg-ink-950/60 p-3 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap text-ink-300 dark:border-ink-800/70">
          {prompt}
        </div>
        <div className="mt-3 flex justify-end">
          <CopyButton value={prompt} />
        </div>
      </div>
    </div>
  );
}

function HandoffsTab() {
  return (
    <div className="space-y-4">
      <div className="card-padded">
        <CardTitle
          icon={Bot}
          title="Agent task handoff"
          hint="Package a unit of work for an autonomous agent."
        />
        <p className="text-[12.5px] leading-relaxed text-ink-300">
          Use the builders below to generate a launch prompt for Claude Code and a
          review prompt for Codex. Fill in the repo path, the goal, and any
          constraints, then copy the rendered prompt into your terminal or review
          tool. Pair them: Claude Code builds, Codex reviews.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PromptBuilder
          icon={Terminal}
          title="Claude Code launch prompt"
          hint="Generates a ready-to-paste agent kickoff prompt."
          build={CLAUDE_CODE_PROMPT_TEMPLATE}
        />
        <PromptBuilder
          icon={ClipboardCheck}
          title="Codex review prompt"
          hint="Generates a second-opinion review prompt."
          build={CODEX_REVIEW_PROMPT_TEMPLATE}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// QA tab
// ---------------------------------------------------------------------------

function Checklist({
  icon,
  title,
  items,
}: {
  icon: LucideIcon;
  title: string;
  items: string[];
}) {
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const done = Object.values(checked).filter(Boolean).length;

  function toggle(index: number): void {
    setChecked((prev) => ({ ...prev, [index]: !prev[index] }));
  }

  return (
    <div className="card-padded">
      <div className="flex items-start justify-between gap-3">
        <CardTitle icon={icon} title={title} />
        <span className={cn("shrink-0", done === items.length ? "chip-ok" : "chip")}>
          {done}/{items.length}
        </span>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, index) => {
          const isOn = Boolean(checked[index]);
          return (
            <li key={index}>
              <button
                type="button"
                onClick={() => toggle(index)}
                className="flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-ink-900/40"
              >
                <span
                  className={cn(
                    "mt-0.5 shrink-0",
                    isOn ? "text-accent-gold" : "text-ink-500",
                  )}
                >
                  {isOn ? <CheckSquare size={15} /> : <Square size={15} />}
                </span>
                <span
                  className={cn(
                    "text-[12.5px] leading-relaxed",
                    isOn ? "text-ink-400 line-through" : "text-ink-200",
                  )}
                >
                  {item}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function QaTab() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Checklist
        icon={Rocket}
        title="Netlify QA"
        items={NETLIFY_QA_CHECKLIST}
      />
      <Checklist
        icon={ClipboardCheck}
        title="Supabase QA"
        items={SUPABASE_QA_CHECKLIST}
      />
      <Checklist
        icon={CheckSquare}
        title="Desktop build QA"
        items={DESKTOP_BUILD_QA_CHECKLIST}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Incubator tab
// ---------------------------------------------------------------------------

function IncubatorTab() {
  const [ideas, setIdeas] = useState<IdeaCard[]>([
    {
      id: uid(),
      title: "Loan officer micro-tools",
      pitch: "Tiny single-purpose calculators that funnel back into LegendsOS.",
    },
  ]);
  const [title, setTitle] = useState("");
  const [pitch, setPitch] = useState("");

  const [siteTopic, setSiteTopic] = useState("");
  const [siteAudience, setSiteAudience] = useState("");

  function addIdea(): void {
    const t = title.trim();
    if (!t) return;
    setIdeas((prev) => [{ id: uid(), title: t, pitch: pitch.trim() }, ...prev]);
    setTitle("");
    setPitch("");
  }

  function removeIdea(id: string): void {
    setIdeas((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card-padded">
        <CardTitle
          icon={Lightbulb}
          title="Product incubator"
          hint="Capture raw ideas before they evaporate."
        />
        <div className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Idea title"
            className="w-full rounded-lg border border-ink-200 bg-white/70 px-3 py-2 text-[13px] text-ink-900 placeholder:text-ink-400 outline-none focus:border-accent-gold/50 dark:border-ink-800 dark:bg-ink-900/70 dark:text-ink-100"
          />
          <textarea
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
            rows={2}
            placeholder="One-line pitch"
            className="w-full rounded-lg border border-ink-200 bg-white/70 px-3 py-2 text-[13px] text-ink-900 placeholder:text-ink-400 outline-none focus:border-accent-gold/50 dark:border-ink-800 dark:bg-ink-900/70 dark:text-ink-100"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={addIdea}
              disabled={!title.trim()}
              className="btn-primary gap-2 disabled:opacity-40"
            >
              <Plus size={14} />
              Add idea
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {ideas.length === 0 ? (
            <p className="text-[12.5px] text-ink-400">No ideas captured yet.</p>
          ) : (
            ideas.map((idea) => (
              <div
                key={idea.id}
                className="rounded-lg border border-ink-200/70 bg-ink-900/30 px-3 py-2 dark:border-ink-800/70"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[13px] font-semibold text-ink-100">
                    {idea.title}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeIdea(idea.id)}
                    className="text-[11px] uppercase tracking-wide text-ink-400 hover:text-status-err"
                  >
                    Remove
                  </button>
                </div>
                {idea.pitch && (
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-300">
                    {idea.pitch}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card-padded">
        <CardTitle
          icon={Sparkles}
          title="Website & blog builder"
          hint="Outline a marketing site or blog, then build it in vibe-coding."
        />
        <p className="text-[12.5px] leading-relaxed text-ink-300">
          Sketch the topic and audience here, then jump into{" "}
          <span className="text-accent-gold">/vibe-coding</span> to generate and
          iterate on the actual site and posts.
        </p>
        <div className="mt-3 space-y-3">
          <input
            value={siteTopic}
            onChange={(e) => setSiteTopic(e.target.value)}
            placeholder="Site / blog topic"
            className="w-full rounded-lg border border-ink-200 bg-white/70 px-3 py-2 text-[13px] text-ink-900 placeholder:text-ink-400 outline-none focus:border-accent-gold/50 dark:border-ink-800 dark:bg-ink-900/70 dark:text-ink-100"
          />
          <input
            value={siteAudience}
            onChange={(e) => setSiteAudience(e.target.value)}
            placeholder="Audience"
            className="w-full rounded-lg border border-ink-200 bg-white/70 px-3 py-2 text-[13px] text-ink-900 placeholder:text-ink-400 outline-none focus:border-accent-gold/50 dark:border-ink-800 dark:bg-ink-900/70 dark:text-ink-100"
          />
          <a href="/vibe-coding" className="btn-secondary inline-flex gap-2">
            <Rocket size={14} />
            Open vibe-coding
          </a>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root workspace
// ---------------------------------------------------------------------------

export function BuilderWorkspace() {
  const [active, setActive] = useState<TabKey>("projects");

  return (
    <div className="space-y-5">
      <div className="scrollbar-thin -mx-1 flex gap-1.5 overflow-x-auto px-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActive(tab.key)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-lg border px-3.5 py-2 text-[12.5px] font-medium transition",
                isActive
                  ? "border-accent-gold/40 bg-accent-gold/10 text-accent-gold"
                  : "border-ink-200/70 text-ink-300 hover:border-ink-300 hover:text-ink-100 dark:border-ink-800/70",
              )}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {active === "projects" && <ProjectsTab />}
      {active === "capture" && <CaptureTab />}
      {active === "plan" && <PlanTab />}
      {active === "handoffs" && <HandoffsTab />}
      {active === "qa" && <QaTab />}
      {active === "incubator" && <IncubatorTab />}
    </div>
  );
}

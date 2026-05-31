"use client";

import { useCallback, useState } from "react";
import {
  ClipboardCheck,
  FlaskConical,
  Globe,
  Hammer,
  History,
  ScanSearch,
  ScrollText,
  Video,
  type LucideIcon,
} from "lucide-react";

import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { cn } from "@/lib/utils";

import {
  BUILDER_HISTORY_KEY,
  newId,
  type PromptHistoryEntry,
} from "./builderShared";
import {
  ClaudeHandoffPanel,
  CodexReviewPanel,
  HistoryPanel,
  ImplementationPlanPanel,
  IncubatorPanel,
  ProjectsPanel,
  QaPanel,
  RecordReviewPanel,
  WebsitePanel,
  type RecordPrompt,
} from "./panels";

type SectionId =
  | "projects"
  | "record"
  | "plan"
  | "handoff"
  | "codex"
  | "qa"
  | "incubator"
  | "website"
  | "history";

interface SectionDef {
  id: SectionId;
  label: string;
  group: string;
  icon: LucideIcon;
  title: string;
  description: string;
}

const SECTIONS: SectionDef[] = [
  {
    id: "projects",
    label: "Projects",
    group: "Workspace",
    icon: Hammer,
    title: "Project workspace manager",
    description:
      "Track local project entries. Saved in this browser — no database, no sync.",
  },
  {
    id: "record",
    label: "Record review",
    group: "Workspace",
    icon: Video,
    title: "Record review & recordings",
    description:
      "Turn review notes into action lists. Upload + transcription are not yet wired.",
  },
  {
    id: "plan",
    label: "Implementation plan",
    group: "Compose → Atlas",
    icon: ScrollText,
    title: "Implementation plan generator",
    description:
      "Compose a structured plan prompt, then copy it or send it to Atlas.",
  },
  {
    id: "handoff",
    label: "Claude Code handoff",
    group: "Compose → Atlas",
    icon: ClipboardCheck,
    title: "Claude Code handoff builder",
    description: "Compose a precise coding-agent handoff prompt.",
  },
  {
    id: "codex",
    label: "Codex review",
    group: "Compose → Atlas",
    icon: ScanSearch,
    title: "Codex review prompt builder",
    description: "Compose a thorough code-review prompt to copy into Codex.",
  },
  {
    id: "qa",
    label: "QA checklists",
    group: "Compose → Atlas",
    icon: ClipboardCheck,
    title: "Netlify / Supabase / Desktop QA",
    description:
      "Generate a QA checklist prompt for each surface, then copy or send to Atlas.",
  },
  {
    id: "incubator",
    label: "Product incubator",
    group: "Ideas",
    icon: FlaskConical,
    title: "Personal product incubator",
    description: "Pressure-test an idea into a sharp brief.",
  },
  {
    id: "website",
    label: "Website & blog",
    group: "Ideas",
    icon: Globe,
    title: "Website and blog builder",
    description: "Compose page or blog-post prompts, then copy or send to Atlas.",
  },
  {
    id: "history",
    label: "Build logs",
    group: "Logs",
    icon: History,
    title: "Build logs & prompt history",
    description:
      "Every prompt you copy or send is logged here and persists in this browser.",
  },
];

export function BuilderWorkspace({ ownerName }: { ownerName: string }) {
  const [active, setActive] = useState<SectionId>("projects");
  // Bump to force the HistoryPanel to re-read localStorage when a new prompt is
  // recorded from another panel.
  const [historyTick, setHistoryTick] = useState(0);

  // Shared recorder: append a composed prompt to the build-log history in
  // localStorage. Real persistence — survives reloads.
  const record = useCallback<RecordPrompt>((entry) => {
    if (typeof window === "undefined") return;
    if (!entry.prompt.trim()) return;
    const full: PromptHistoryEntry = {
      ...entry,
      id: newId(),
      createdAt: new Date().toISOString(),
    };
    try {
      const raw = window.localStorage.getItem(BUILDER_HISTORY_KEY);
      const list: PromptHistoryEntry[] = raw ? JSON.parse(raw) : [];
      const next = [full, ...(Array.isArray(list) ? list : [])].slice(0, 100);
      window.localStorage.setItem(BUILDER_HISTORY_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable — the copy/send still happened.
    }
    setHistoryTick((t) => t + 1);
  }, []);

  const activeDef = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];

  // Group the rail.
  const groups = SECTIONS.reduce<Record<string, SectionDef[]>>((acc, s) => {
    (acc[s.group] ??= []).push(s);
    return acc;
  }, {});

  function renderActive() {
    switch (active) {
      case "projects":
        return <ProjectsPanel />;
      case "record":
        return <RecordReviewPanel record={record} />;
      case "plan":
        return <ImplementationPlanPanel record={record} />;
      case "handoff":
        return <ClaudeHandoffPanel record={record} />;
      case "codex":
        return <CodexReviewPanel record={record} />;
      case "qa":
        return <QaPanel record={record} />;
      case "incubator":
        return <IncubatorPanel record={record} />;
      case "website":
        return <WebsitePanel record={record} />;
      case "history":
        return <HistoryPanel key={historyTick} />;
      default:
        return null;
    }
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Owner · Builder"
        title="Command workspace"
        description={`${ownerName}'s build cockpit. This is not a separate AI — it composes prompts and sends them to Atlas or copies them. Project entries and prompt history persist locally in this browser.`}
        action={<StatusPill status="ok" label="owner only" />}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[230px_1fr]">
        {/* Left rail of sections */}
        <nav className="card-padded h-max space-y-4 lg:sticky lg:top-4">
          {Object.entries(groups).map(([group, defs]) => (
            <div key={group}>
              <p className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-600 dark:text-ink-400">
                {group}
              </p>
              <div className="space-y-0.5">
                {defs.map((s) => {
                  const Icon = s.icon;
                  const isActive = s.id === active;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActive(s.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] transition",
                        isActive
                          ? "bg-accent-gold/10 text-accent-gold"
                          : "text-ink-700 dark:text-ink-300 hover:bg-ink-100/70 dark:hover:bg-ink-800/60 hover:text-ink-900 dark:hover:text-ink-100",
                      )}
                    >
                      <Icon
                        size={14}
                        className={cn(
                          "shrink-0",
                          isActive
                            ? "text-accent-gold"
                            : "text-ink-600 dark:text-ink-400",
                        )}
                      />
                      <span className="truncate">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Right detail panel */}
        <div className="min-w-0 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-ink-900 dark:text-ink-100">
              {activeDef.title}
            </h2>
            <p className="mt-0.5 text-xs text-ink-700 dark:text-ink-300">
              {activeDef.description}
            </p>
          </div>
          {renderActive()}
        </div>
      </div>
    </div>
  );
}

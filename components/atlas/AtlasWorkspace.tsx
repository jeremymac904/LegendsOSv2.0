"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  BookOpen,
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Database,
  Info,
  Layers3,
  Mail,
  MonitorUp,
  PanelLeft,
  PanelRight,
  Paperclip,
  Pin,
  Search,
  Send,
  Save,
  Share2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import type { AtlasRuntimeContext } from "@/lib/atlas/runtimeContext";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn, formatRelative, truncate } from "@/lib/utils";
import type { AtlasAssistant, ChatMessage, ChatThread } from "@/types/database";

import {
  AtlasProjectsPanel,
  type AtlasKnowledgeCollectionOption,
  type AtlasProjectAccessMap,
  type AtlasProjectSummary,
  type AtlasThreadSummary,
} from "./AtlasProjectsPanel";
import { BuilderPromptCards } from "./BuilderPromptCards";
import { LoanContextPanel, type AtlasLoanContext } from "./LoanContextPanel";
import { LOWorkspace } from "./LOWorkspace";

// ─── Types ──────────────────────────────────────────────────────────────────

type ProviderId = "openrouter" | "deepseek" | "nvidia" | "minimax";

const LS_PROVIDER_KEY = "legendsos-atlas-provider";
const LS_MODEL_KEY = "legendsos-atlas-model";

interface ProviderEntry {
  id: ProviderId;
  label: string;
  configured: boolean;
  enabled: boolean;
}

interface ModelEntry {
  id: string;
  label: string;
}

export interface AtlasWorkspaceProps {
  ownerId: string;
  currentThread?: ChatThread | null;
  /** Pre-fills the composer for "send to Atlas" deep-links (/atlas?prompt=). */
  initialInput?: string;
  initialMessages?: ChatMessage[];
  assistants: AtlasAssistant[];
  providerCatalog: ProviderEntry[];
  modelCatalog: Record<ProviderId, ModelEntry[]>;
  defaultProvider: ProviderId;
  initialRuntimeContext: AtlasRuntimeContext;
  organizationId: string | null;
  projects: AtlasProjectSummary[];
  knowledgeCollections: AtlasKnowledgeCollectionOption[];
  projectAccess: AtlasProjectAccessMap;
  recentThreads: AtlasThreadSummary[];
}

// ─── Tool result card ────────────────────────────────────────────────────────

interface AtlasToolResultMeta {
  kind:
    | "create_social"
    | "create_email"
    | "create_calendar"
    | "explain_capabilities"
    | "create_knowledge_note";
  itemId: string;
  link: string;
  summary: string;
  title?: string | null;
  capabilities?: {
    providers: {
      id: string;
      label: string;
      status: "ready" | "configured" | "disabled" | "missing";
      env_var: string;
      next_action: string | null;
    }[];
  };
}

function deriveToolTitle(result: AtlasToolResultMeta): string {
  if (result.title?.trim()) return result.title.trim();
  const quoted = result.summary.match(/"([^"]+)"/);
  if (quoted?.[1]) return quoted[1];
  return truncate(result.summary, 60);
}

function ToolResultCard({ result, createdAt }: { result: AtlasToolResultMeta; createdAt: string }) {
  const config: Record<string, { icon: React.ComponentType<{ size?: number | string; className?: string }>; label: string; openLabel: string }> = {
    create_social:         { icon: Share2,      label: "Social draft",      openLabel: "Open" },
    create_email:          { icon: Mail,        label: "Newsletter draft",   openLabel: "Open" },
    create_calendar:       { icon: CalendarIcon,label: "Calendar item",     openLabel: "Open" },
    explain_capabilities:  { icon: Info,        label: "Atlas capabilities", openLabel: "Settings" },
    create_knowledge_note: { icon: BookOpen,    label: "Knowledge note",    openLabel: "Open" },
  };
  const entry = config[result.kind];
  if (!entry) return null;
  const Icon = entry.icon;
  const title = deriveToolTitle(result);
  const providerDots = result.kind === "explain_capabilities" ? result.capabilities?.providers?.slice(0, 5) ?? [] : [];
  let timeLabel = "";
  try {
    const d = new Date(createdAt);
    if (!isNaN(d.getTime())) timeLabel = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {}
  return (
    <div className="mt-2.5 flex items-center gap-3 rounded-xl border border-accent-gold/30 bg-accent-gold/5 px-3 py-2.5 backdrop-blur-sm">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-accent-gold/30 bg-accent-gold/15 text-accent-gold">
        <Icon size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-gold">
          {entry.label}
          {timeLabel && <span className="ml-1.5 font-normal text-ink-600 dark:text-ink-300">· {result.kind === "explain_capabilities" ? "Snapshot" : "Created"} {timeLabel}</span>}
        </p>
        <p className="truncate text-[12px] font-medium text-ink-900 dark:text-ink-100">{title}</p>
        {providerDots.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {providerDots.map((p) => (
              <span key={p.id} title={p.next_action ?? `${p.label} is ${p.status}`} className="inline-flex items-center gap-1 rounded-full border border-ink-200/80 dark:border-ink-700/80 bg-white/60 dark:bg-ink-900/60 px-1.5 py-[1px] text-[9.5px] uppercase tracking-[0.14em] text-ink-600 dark:text-ink-300">
                <span className={cn("h-1.5 w-1.5 rounded-full", p.status === "ready" ? "bg-status-ok" : p.status === "disabled" ? "bg-status-off" : "bg-status-warn")} />
                {p.label}
              </span>
            ))}
          </div>
        )}
        <p className="mt-1 text-[11px] leading-relaxed text-ink-600 dark:text-ink-300">
          {result.summary}
        </p>
      </div>
      <a href={result.link} className="btn-secondary h-8 shrink-0 px-2.5 text-[11px]">{entry.openLabel} →</a>
    </div>
  );
}

function Markdown({ content }: { content: string }) {
  return <div className="whitespace-pre-wrap">{content}</div>;
}

function MessageRow({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const meta = (message.metadata ?? {}) as {
    knowledge_hits?: number;
    knowledge_sources?: { title: string; source_path: string | null }[];
    tool_result?: AtlasToolResultMeta;
  };
  const khits = meta.knowledge_hits ?? 0;
  const ksources = meta.knowledge_sources ?? [];
  const toolResult = meta.tool_result;
  return (
    <div className={cn("flex flex-col gap-1.5", isUser ? "items-end" : isSystem ? "items-center" : "items-start")}>
      {!isUser && !isSystem && khits > 0 && (
        <div className="flex max-w-full flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-gold/30 bg-accent-gold/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-accent-gold">
            <Sparkles size={9} />{khits} source{khits === 1 ? "" : "s"}
          </span>
          {ksources.slice(0, 3).map((s, i) => (
            <span key={`${i}-${s.title}`} className="inline-flex max-w-[18rem] items-center gap-1 truncate rounded-full border border-ink-200/70 dark:border-ink-700/70 bg-white/70 dark:bg-ink-900/70 px-2 py-0.5 text-[10px] text-ink-800 dark:text-ink-200">
              <span aria-hidden className="text-accent-gold/70">·</span>
              <span className="truncate">{s.source_path ? `${s.title} · ${s.source_path.split("/").slice(-2).join("/")}` : s.title}</span>
            </span>
          ))}
          {ksources.length > 3 && <span className="inline-flex items-center rounded-full border border-ink-200/70 dark:border-ink-700/70 bg-white/70 dark:bg-ink-900/70 px-2 py-0.5 text-[10px] text-ink-600 dark:text-ink-300">+{ksources.length - 3} more</span>}
        </div>
      )}
      <div className={cn(
        "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
        // User messages stay plain text (pre-wrap). Assistant/system messages
        // run through the markdown renderer, which manages its own whitespace.
        isUser && "whitespace-pre-wrap",
        isUser ? "bg-gradient-to-br from-accent-orange/80 to-accent-gold/80 text-ink-950 dark:text-ink-950"
          : isSystem ? "border border-status-warn/30 bg-status-warn/10 text-status-warn"
          : "border border-ink-200 dark:border-ink-800 bg-white/70 dark:bg-ink-900/70 text-ink-900 dark:text-ink-100"
      )}>
        {isUser ? message.content : <Markdown content={message.content} />}
        {!isUser && !isSystem && toolResult && <ToolResultCard result={toolResult} createdAt={message.created_at} />}
        <p className={cn("mt-1.5 text-[10px] uppercase tracking-[0.18em]", isUser ? "text-ink-950/60 dark:text-ink-950/60" : "text-ink-600 dark:text-ink-300")}>
          {message.role} · {formatRelative(message.created_at)}
        </p>
      </div>
    </div>
  );
}

// ─── EmptyChat ───────────────────────────────────────────────────────────────

const STARTER_PROMPTS = [
  "Draft a rate-update text for a past client.",
  "Explain FHA vs conventional for a first-time buyer.",
  "Write a follow-up email to a pre-approved buyer who went quiet.",
  "Turn this week's market update into a social post.",
];

function EmptyChat({ provider, configured, onPick }: {
  provider: string; configured: boolean; onPick: (p: string) => void;
}) {
  // Builder templates are collapsed by default so the empty state stays
  // compact — clicking a starter prompt fills the composer instead of
  // throwing the user down a wall of cards.
  const [showTemplates, setShowTemplates] = useState(false);
  return (
    <div className="flex min-h-full items-center justify-center py-6">
      <div className="w-full max-w-2xl">
        <div className="flex flex-col items-center text-center">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-accent-gold via-accent-gold to-accent-orange text-ink-950">
            <Sparkles size={15} />
          </div>
          <h2 className="mt-2.5 text-lg font-semibold text-ink-900 dark:text-ink-100">How can Atlas help?</h2>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-ink-600 dark:text-ink-300">Your command center for the whole platform — marketing copy, mortgage explainers, client messages, and anything in your daily workflow. Pick a starting point or just ask.</p>
          {!configured && <p className="mt-2 text-[11px] text-status-warn">{provider} is not configured — pick another provider in the chip above.</p>}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {STARTER_PROMPTS.map((p) => (
            <button key={p} type="button" onClick={() => onPick(p)}
              className="rounded-xl border border-ink-200 dark:border-accent-champagne/10 bg-white/60 dark:bg-ink-950/40 px-3 py-2 text-left text-[12px] text-ink-800 dark:text-ink-200 transition hover:border-accent-champagne/40 hover:bg-accent-gold/5 hover:text-ink-900 dark:hover:text-ink-100">
              {p}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowTemplates((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-ink-200 dark:border-accent-champagne/10 bg-white/40 dark:bg-ink-950/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-600 dark:text-ink-300 transition hover:border-accent-champagne/40 hover:text-ink-900 dark:hover:text-ink-100"
          >
            <span>Builder templates</span>
            <ChevronDown size={14} className={cn("transition-transform", showTemplates && "rotate-180")} />
          </button>
          {showTemplates && (
            <div className="mt-2">
              <BuilderPromptCards onPick={onPick} compact />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface WorkspaceResource {
  id: string;
  type: "source" | "action";
  title: string;
  detail: string;
  link?: string;
}

function buildResources(messages: ChatMessage[]): WorkspaceResource[] {
  const out: WorkspaceResource[] = [];
  const seen = new Set<string>();
  for (const message of messages) {
    const meta = (message.metadata ?? {}) as {
      knowledge_sources?: { title: string; source_path: string | null }[];
      tool_result?: AtlasToolResultMeta;
    };
    for (const source of meta.knowledge_sources ?? []) {
      const key = `source:${source.title}:${source.source_path ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: key,
        type: "source",
        title: source.title,
        detail: source.source_path
          ? source.source_path.split("/").slice(-3).join("/")
          : "Knowledge source",
      });
    }
    if (meta.tool_result) {
      const result = meta.tool_result;
      const key = `tool:${result.kind}:${result.itemId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: key,
        type: "action",
        title: deriveToolTitle(result),
        detail: result.summary,
        link: result.link,
      });
    }
  }
  return out.slice(-10).reverse();
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

function ContextCountRow({
  label,
  status,
  count,
}: {
  label: string;
  status: string;
  count: number;
}) {
  const good = status === "loaded" || status === "matched";
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-ink-200/80 bg-white/40 px-2 py-1.5 text-[10.5px] dark:border-ink-800/80 dark:bg-ink-900/30">
      <span className="text-ink-700 dark:text-ink-200">{label}</span>
      <span
        className={cn(
          "rounded-full px-1.5 py-px text-[9.5px] uppercase tracking-[0.12em]",
          good
            ? "bg-status-ok/10 text-status-ok"
            : status === "setup_needed" || status === "error"
            ? "bg-status-warn/10 text-status-warn"
            : "bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400"
        )}
      >
        {count > 0 ? count : statusLabel(status)}
      </span>
    </div>
  );
}

function AssistantRuntimeContextPanel({
  context,
  actionMessage,
  onRuntimeAction,
}: {
  context: AtlasRuntimeContext;
  actionMessage: string | null;
  onRuntimeAction: (action: "save_memory" | "save_skill" | "promote_skill" | "share_skill") => void;
}) {
  const modelLabel = [
    context.model.provider ?? "default provider",
    context.model.model ? context.model.model.split("/").slice(-1)[0] : "default model",
  ].join(" / ");

  return (
    <div className="border-b border-ink-200 p-3 dark:border-ink-800">
      <div className="rounded-xl border border-accent-champagne/20 bg-white/40 p-3 dark:bg-ink-900/35">
        <div className="flex items-start gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-accent-gold/25 bg-accent-gold/10 text-accent-gold">
            <Database size={13} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-gold">
              Current assistant
            </p>
            <p className="truncate text-[12px] font-semibold text-ink-900 dark:text-ink-100">
              {context.current_assistant.name}
            </p>
            <p className="mt-0.5 truncate text-[10.5px] text-ink-500 dark:text-ink-400">
              {modelLabel}
            </p>
          </div>
        </div>

        <div className="mt-3 grid gap-1.5">
          <ContextCountRow label="Loaded memory" status={context.memory.status} count={context.memory.items.length} />
          <ContextCountRow label="Loaded skills" status={context.skills.status} count={context.skills.items.length} />
          <ContextCountRow label="Loan context" status={context.loan.status} count={context.loan.status === "matched" ? 1 : 0} />
          <ContextCountRow label="Browser context" status={context.browser.status} count={context.browser.captures.length} />
          <ContextCountRow label="Knowledge sources" status={context.knowledge.status} count={context.knowledge.attached_sources.length} />
          <ContextCountRow label="Loaded tools" status="loaded" count={context.tools.items.length} />
        </div>

        {context.memory.items.length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">
              Memory
            </p>
            <ul className="mt-1 space-y-1">
              {context.memory.items.slice(0, 3).map((item) => (
                <li key={item.id} className="text-[10.5px] leading-snug text-ink-600 dark:text-ink-300">
                  <span className="font-medium text-ink-900 dark:text-ink-100">{item.title}</span>
                  {item.body ? ` — ${truncate(item.body, 90)}` : null}
                </li>
              ))}
            </ul>
          </div>
        )}

        {context.skills.items.length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">
              Skills
            </p>
            <ul className="mt-1 space-y-1">
              {context.skills.items.slice(0, 3).map((skill) => (
                <li key={skill.id} className="text-[10.5px] leading-snug text-ink-600 dark:text-ink-300">
                  <span className="font-medium text-ink-900 dark:text-ink-100">{skill.skill_name}</span>
                  {skill.is_shared_with_team ? " · team shared" : ""}
                </li>
              ))}
            </ul>
          </div>
        )}

        {context.browser.captures.length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">
              Browser
            </p>
            <ul className="mt-1 space-y-1">
              {context.browser.captures.slice(0, 2).map((capture) => (
                <li key={capture.id} className="text-[10.5px] leading-snug text-ink-600 dark:text-ink-300">
                  <span className="font-medium text-ink-900 dark:text-ink-100">
                    {capture.source_title ?? "Captured page"}
                  </span>
                  {capture.source_url ? ` — ${truncate(capture.source_url, 80)}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-1.5">
          <button type="button" onClick={() => onRuntimeAction("save_memory")} className="btn-secondary h-8 px-2 text-[10.5px]">
            Save as memory
          </button>
          <button type="button" onClick={() => onRuntimeAction("save_skill")} className="btn-secondary h-8 px-2 text-[10.5px]">
            Save as skill
          </button>
          <button type="button" onClick={() => onRuntimeAction("promote_skill")} className="btn-secondary h-8 px-2 text-[10.5px]">
            Promote skill
          </button>
          <button type="button" onClick={() => onRuntimeAction("share_skill")} className="btn-secondary h-8 px-2 text-[10.5px]">
            Share skill
          </button>
        </div>
        {actionMessage && (
          <p className="mt-2 rounded-lg border border-accent-gold/25 bg-accent-gold/10 px-2 py-1.5 text-[10.5px] text-ink-700 dark:text-ink-200">
            {actionMessage}
          </p>
        )}
      </div>
    </div>
  );
}

function WorkspaceResourcePanel({
  messages,
  currentProject,
  loanContext,
  runtimeContext,
  actionMessage,
  onPrompt,
  onRuntimeAction,
}: {
  messages: ChatMessage[];
  currentProject: AtlasProjectSummary | null;
  loanContext: AtlasLoanContext | null;
  runtimeContext: AtlasRuntimeContext;
  actionMessage: string | null;
  onPrompt: (prompt: string) => void;
  onRuntimeAction: (action: "save_memory" | "save_skill" | "promote_skill" | "share_skill") => void;
}) {
  const resources = buildResources(messages);
  const tasks = taskList(currentProject?.metadata);
  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar-thin">
      <div className="border-b border-ink-200 dark:border-ink-800 px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-600 dark:text-ink-300">
          Assistant context
        </p>
        <p className="mt-1 text-[10.5px] leading-snug text-ink-500 dark:text-ink-500">
          What Atlas loaded before the current response.
        </p>
      </div>
      <AssistantRuntimeContextPanel
        context={runtimeContext}
        actionMessage={actionMessage}
        onRuntimeAction={onRuntimeAction}
      />
      {/* Loan memory context — additive, only shown when Atlas loaded a loan. */}
      {loanContext && <LoanContextPanel context={loanContext} />}
      <div className="space-y-2 p-3">
        {resources.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink-200 dark:border-ink-700 bg-white/30 dark:bg-ink-900/30 p-3">
            <p className="text-[11px] font-medium text-ink-800 dark:text-ink-200">No sources yet</p>
            <p className="mt-1 text-[10.5px] leading-snug text-ink-500 dark:text-ink-400">
              Ask Atlas to use project knowledge, create a draft, schedule an item, or explain connected tools.
            </p>
            <div className="mt-3 grid gap-1.5">
              {[
                "What sources are attached to this project?",
                "Draft a social post using this project knowledge.",
                "What tools and connectors are available right now?",
              ].map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => onPrompt(prompt)}
                  className="rounded-lg border border-ink-200 dark:border-ink-800 bg-white/40 dark:bg-ink-950/40 px-2 py-1.5 text-left text-[10.5px] text-ink-600 dark:text-ink-300 hover:border-accent-gold/30 hover:text-ink-900 dark:hover:text-ink-100"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          resources.map((resource) => (
            <div
              key={resource.id}
              className="rounded-xl border border-ink-200 dark:border-ink-800 bg-white/40 dark:bg-ink-900/40 p-2.5"
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg border border-accent-gold/20 bg-accent-gold/10 text-accent-gold">
                  {resource.type === "source" ? <Search size={12} /> : <Sparkles size={12} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11.5px] font-medium text-ink-900 dark:text-ink-100">
                    {resource.title}
                  </p>
                  <p className="mt-0.5 line-clamp-3 text-[10.5px] leading-snug text-ink-500 dark:text-ink-400">
                    {resource.detail}
                  </p>
                  {resource.link && (
                    <a
                      href={resource.link}
                      className="mt-2 inline-flex text-[10.5px] text-accent-gold hover:text-ink-900 dark:hover:text-ink-100"
                    >
                      Open result
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      {currentProject && (
        <div className="border-t border-ink-200 dark:border-ink-800 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-600 dark:text-ink-300">
            Active project
          </p>
          <div className="mt-2 rounded-xl border border-accent-gold/25 bg-accent-gold/[0.06] p-3">
            <p className="truncate text-[12px] font-semibold text-ink-900 dark:text-ink-100">
              {currentProject.name}
            </p>
            <p className="mt-1 line-clamp-3 text-[10.5px] leading-snug text-ink-600 dark:text-ink-300">
              {currentProject.description || "Project instructions and sources are active for new chats."}
            </p>
            {tasks.length > 0 && (
              <ul className="mt-2 space-y-1">
                {tasks.slice(0, 4).map((task) => (
                  <li key={task} className="flex gap-1.5 text-[10.5px] text-ink-600 dark:text-ink-300">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-gold/70" />
                    <span className="line-clamp-2">{task}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      <div className="border-t border-ink-200 dark:border-ink-800">
        <LOWorkspace onPrompt={onPrompt} />
      </div>
    </div>
  );
}

function taskList(metadata: Record<string, unknown> | null | undefined): string[] {
  const raw = metadata?.tasks;
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

function ThreadControlButton({
  icon: Icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "hidden h-7 items-center gap-1.5 rounded-full border px-2.5 text-[10.5px] font-medium transition sm:inline-flex",
        active
          ? "border-accent-gold/40 bg-accent-gold/10 text-accent-gold"
          : "border-ink-200/80 bg-white/50 text-ink-600 hover:border-accent-champagne/50 hover:text-ink-900 dark:border-ink-700/80 dark:bg-ink-950/50 dark:text-ink-300 dark:hover:text-ink-100",
        disabled && "cursor-not-allowed opacity-45"
      )}
      title={disabled ? "Available after the first message is sent" : label}
    >
      <Icon size={11} />
      {label}
    </button>
  );
}

// ─── ProviderModelChip ───────────────────────────────────────────────────────

function ProviderModelChip(props: {
  provider: ProviderId; setProvider: (p: ProviderId) => void;
  model: string; setModel: (m: string) => void;
  providerCatalog: ProviderEntry[]; modelCatalog: Record<ProviderId, ModelEntry[]>;
}) {
  const { provider, setProvider, model, setModel, providerCatalog, modelCatalog } = props;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) { if (!ref.current?.contains(e.target as Node)) setOpen(false); }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, [open]);
  const providerEntry = providerCatalog.find((p) => p.id === provider);
  const currentModelEntry = (modelCatalog[provider] ?? []).find((m) => m.id === model);
  const modelShort = currentModelEntry ? (currentModelEntry.id.split("/").slice(-1)[0] || currentModelEntry.id) : "default";
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)}
        className={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-full border border-ink-200/80 dark:border-ink-700/80 bg-white/70 dark:bg-ink-900/70 px-3 text-[11px] font-medium text-ink-900 dark:text-ink-100 backdrop-blur-sm transition hover:border-accent-gold/60",
          open && "border-accent-gold/60 bg-accent-gold/5 text-accent-gold",
          providerEntry && !providerEntry.configured && "text-status-warn"
        )}>
        <span className={cn("h-1.5 w-1.5 rounded-full",
          providerEntry?.configured ? providerEntry.enabled ? "bg-status-ok" : "bg-status-off" : "bg-status-warn"
        )} />
        <span className="truncate">{providerEntry?.label ?? provider}<span className="mx-1 text-ink-500 dark:text-ink-500">·</span><span className="text-ink-600 dark:text-ink-300">{truncate(modelShort, 20)}</span></span>
        <ChevronDown size={11} className="shrink-0 opacity-70" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1.5 w-72 overflow-hidden rounded-xl border border-ink-200 dark:border-ink-700 bg-white/95 dark:bg-ink-900/95 shadow-card backdrop-blur">
          <div className="flex items-center justify-between gap-2 border-b border-ink-200 dark:border-ink-800 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-600 dark:text-ink-300">Model selector</p>
            <button type="button" onClick={() => setOpen(false)} className="text-ink-500 dark:text-ink-400 hover:text-ink-900 dark:hover:text-ink-100"><X size={11} /></button>
          </div>
          <div className="max-h-72 overflow-y-auto px-1.5 py-2 scrollbar-thin">
            {providerCatalog.map((p) => {
              const pModels = modelCatalog[p.id] ?? [];
              const isDisabled = !p.configured || !p.enabled;
              return (
                <div key={p.id} className="mb-2 last:mb-0">
                  <p className={cn("flex items-center gap-2 px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.18em]", isDisabled ? "text-ink-500 dark:text-ink-500" : "text-ink-500 dark:text-ink-400")}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", p.configured ? p.enabled ? "bg-status-ok" : "bg-status-off" : "bg-status-warn")} />
                    {p.label}
                    {!p.configured && <span className="ml-auto text-[9px] font-normal text-status-warn">Not configured</span>}
                  </p>
                  <button type="button" disabled={isDisabled}
                    onClick={() => { setProvider(p.id); setModel(pModels[0]?.id ?? ""); setOpen(false); }}
                    className={cn("flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] transition",
                      isDisabled ? "cursor-not-allowed text-ink-500 dark:text-ink-500" : provider === p.id ? "bg-accent-gold/10 text-accent-gold" : "text-ink-800 dark:text-ink-200 hover:bg-ink-100/70 dark:hover:bg-ink-800/70"
                    )}>
                    <span>{pModels[0]?.label ?? "provider default"}</span>
                    {provider === p.id && !isDisabled && <Check size={11} className="text-accent-gold" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AtlasWorkspace (main export) ────────────────────────────────────────────

export function AtlasWorkspace({
  ownerId, currentThread, initialInput = "", initialMessages = [],
  assistants: _assistants, providerCatalog, modelCatalog, defaultProvider,
  initialRuntimeContext,
  organizationId, projects, knowledgeCollections, projectAccess, recentThreads,
}: AtlasWorkspaceProps) {
  const router = useRouter();
  const [threadId, setThreadId] = useState<string | null>(currentThread?.id ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState(initialInput);
  const [provider, setProvider] = useState<ProviderId>(defaultProvider);
  const [model, setModel] = useState<string>("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    currentThread?.assistant_id ?? null
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Loan memory context returned by the chat route when a message resolves to a
  // loan. Null until/unless a loan-related question is answered. Additive only.
  const [loanContext, setLoanContext] = useState<AtlasLoanContext | null>(null);
  const [runtimeContext, setRuntimeContext] =
    useState<AtlasRuntimeContext>(initialRuntimeContext);
  const [contextAction, setContextAction] = useState<string | null>(null);
  const [threadFlags, setThreadFlags] = useState({
    is_pinned: Boolean((currentThread as (ChatThread & { is_pinned?: boolean }) | null)?.is_pinned),
    is_saved: Boolean((currentThread as (ChatThread & { is_saved?: boolean }) | null)?.is_saved),
  });
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const autoOpenedResourcesRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const sp = window.localStorage.getItem(LS_PROVIDER_KEY) as ProviderId | null;
      const sm = window.localStorage.getItem(LS_MODEL_KEY);
      if (sp && ["openrouter","deepseek","nvidia","minimax"].includes(sp)) {
        const entry = providerCatalog.find((p) => p.id === sp);
        if (entry?.configured && entry.enabled) { setProvider(sp); if (sm) setModel(sm); }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { try { window.localStorage.setItem(LS_PROVIDER_KEY, provider); } catch {} }, [provider]);
  useEffect(() => { try { if (model) window.localStorage.setItem(LS_MODEL_KEY, model); } catch {} }, [model]);

  const models = useMemo(() => modelCatalog?.[provider] ?? [], [modelCatalog, provider]);
  useEffect(() => {
    if (models.length === 0) { setModel(""); return; }
    if (!models.some((m) => m.id === model)) setModel(models[0].id);
  }, [provider, models, model]);

  useEffect(() => { if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight; }, [messages]);
  useEffect(() => {
    setThreadId(currentThread?.id ?? null);
    setMessages(initialMessages);
    setSelectedProjectId(currentThread?.assistant_id ?? null);
    setLoanContext(null);
    setRuntimeContext(initialRuntimeContext);
    setThreadFlags({
      is_pinned: Boolean((currentThread as (ChatThread & { is_pinned?: boolean }) | null)?.is_pinned),
      is_saved: Boolean((currentThread as (ChatThread & { is_saved?: boolean }) | null)?.is_saved),
    });
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [currentThread?.id]);

  const providerEntry = providerCatalog.find((p) => p.id === provider);
  const currentProject = projects.find((p) => p.id === selectedProjectId) ?? null;
  const hasWorkspaceResources = useMemo(
    () => buildResources(messages).length > 0 || Boolean(currentProject) || Boolean(loanContext),
    [messages, currentProject, loanContext]
  );

  useEffect(() => {
    if (!hasWorkspaceResources || rightOpen || autoOpenedResourcesRef.current) return;
    if (typeof window !== "undefined" && window.innerWidth >= 1280) {
      autoOpenedResourcesRef.current = true;
      setRightOpen(true);
    }
  }, [hasWorkspaceResources, rightOpen]);

  function injectPrompt(prompt: string) { setInput(prompt); setTimeout(() => composerRef.current?.focus(), 0); }

  function addAttachments(files: File[]) {
    if (files.length === 0) return;
    setAttachments((prev) => [...prev, ...files]);
  }

  function handleAttach(files: FileList | null) {
    if (!files || files.length === 0) return;
    addAttachments(Array.from(files));
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(e.clipboardData.files ?? []);
    const itemFiles = Array.from(e.clipboardData.items ?? [])
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    const combined = [...files, ...itemFiles];
    if (combined.length > 0) {
      e.preventDefault();
      addAttachments(combined);
      setError(null);
    }
  }

  async function captureScreen() {
    setError(null);
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        setError("Screen or window capture is available in the desktop app or supported browsers. Attach a screenshot file instead.");
        return;
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();
      await new Promise((resolve) => window.setTimeout(resolve, 250));
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1440;
      canvas.height = video.videoHeight || 900;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not capture screen frame.");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      stream.getTracks().forEach((track) => track.stop());
      if (!blob) throw new Error("Could not encode screenshot.");
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      addAttachments([
        new File([blob], `atlas-screen-capture-${stamp}.png`, {
          type: "image/png",
        }),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Screen capture failed.");
    }
  }

  function selectProject(projectId: string | null) {
    setSelectedProjectId(projectId);
    if (threadId && currentThread?.assistant_id !== projectId) {
      setThreadId(null);
      setMessages([]);
      router.replace("/atlas");
    }
    setTimeout(() => composerRef.current?.focus(), 0);
  }

  async function uploadAttachments(scopeId: string): Promise<string[]> {
    if (attachments.length === 0) return [];
    const supabase = getSupabaseBrowserClient();
    const uploaded: string[] = [];
    for (const file of attachments) {
      const path = `${ownerId}/atlas/${scopeId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("uploads").upload(path, file, { upsert: false });
      if (upErr) { setError(`Upload failed: ${upErr.message}`); continue; }
      const { data: row } = await supabase.from("uploaded_files").insert({
        user_id: ownerId, bucket: "uploads", storage_path: path,
        file_name: file.name, mime_type: file.type, size_bytes: file.size, source_module: "atlas",
      }).select("id").single();
      if (row) uploaded.push(file.name);
    }
    setAttachments([]);
    return uploaded;
  }

  async function send() {
    if ((!input.trim() && attachments.length === 0) || isPending) return;
    if (providerEntry && !providerEntry.configured) { setError(`${providerEntry.label} is not configured.`); return; }
    setError(null);
    const userText = input.trim() || "Review the attached file(s).";
    setInput("");
    const tempMsg: ChatMessage = { id: `local-${Date.now()}`, thread_id: threadId ?? "pending", user_id: ownerId, role: "user", content: userText, metadata: {}, token_count: null, created_at: new Date().toISOString() };
    setMessages((m) => [...m, tempMsg]);
    composerRef.current?.focus();
    startTransition(async () => {
      try {
        const uploaded = await uploadAttachments(threadId ?? `new-${Date.now()}`);
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            thread_id: threadId,
            assistant_id: selectedProjectId,
            provider,
            ...(model ? { model } : {}),
            message: uploaded.length > 0 ? `${userText}\n\n[attached files: ${uploaded.join(", ")}]` : userText,
          }),
        });
        const ct = res.headers.get("content-type") ?? "";
        if (!ct.includes("application/json")) { setError(res.status === 401 ? "Your session expired." : "Atlas received a non-JSON response."); return; }
        const data = await res.json();
        if (!data.ok) {
          let msg = `${data.error}: ${data.message}`;
          if (data.error === "unauthenticated") msg = "Your session expired. Refresh and sign in again.";
          else if (
            data.error === "cap_exceeded" ||
            data.error === "provider_disabled" ||
            data.error === "provider_not_configured"
          ) msg = data.message;
          else if (data.error === "provider_error" || data.error === "internal_error") {
            msg =
              "Atlas could not reach the selected AI provider. Try OpenRouter or DeepSeek from the provider selector, then ask the owner to check Settings -> AI Provider Gateway.";
          }
          setError(msg);
          setMessages((m) => [...m, { ...tempMsg, id: `local-sys-${Date.now()}`, role: "system", content: data.message ?? "Atlas could not complete that request." }]);
          return;
        }
        const newTid = data.thread_id as string;
        // The chat route returns a compact loan context object when the message
        // resolved to a loan. Read it defensively; leave prior context if absent.
        if (data.loan_context && typeof data.loan_context === "object") {
          setLoanContext(data.loan_context as AtlasLoanContext);
        }
        if (data.runtime_context && typeof data.runtime_context === "object") {
          setRuntimeContext(data.runtime_context as AtlasRuntimeContext);
        }
        if (!threadId) { setThreadId(newTid); router.replace(`/atlas/${newTid}`); }
        setMessages((m) => [...m, { id: data.message_id ?? `asst-${Date.now()}`, thread_id: newTid, user_id: ownerId, role: "assistant", content: data.content, metadata: { provider: data.provider, model: data.model, knowledge_hits: data.knowledge?.count ?? 0, knowledge_sources: data.knowledge?.sources ?? [], ...(data.tool_result ? { tool_result: data.tool_result } : {}) }, token_count: null, created_at: new Date().toISOString() }]);
        router.refresh();
      } catch (e) { setError(e instanceof Error ? e.message : "Send failed."); }
    });
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }

  function recentConversationText(): string {
    const source = messages.length ? messages : initialMessages;
    return source
      .slice(-8)
      .map((message) => `${message.role}: ${message.content}`)
      .join("\n\n")
      .slice(0, 6000);
  }

  async function runRuntimeAction(
    action: "save_memory" | "save_skill" | "promote_skill" | "share_skill"
  ) {
    setContextAction(null);
    try {
      const res = await fetch("/api/atlas/runtime", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          action,
          thread_id: threadId,
          assistant_id: selectedProjectId,
          content: recentConversationText() || input,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setContextAction(data.message ?? data.error ?? "Runtime action failed.");
        return;
      }
      setContextAction(data.message ?? "Saved.");
      if (data.runtime_context && typeof data.runtime_context === "object") {
        setRuntimeContext(data.runtime_context as AtlasRuntimeContext);
      }
      router.refresh();
    } catch (e) {
      setContextAction(e instanceof Error ? e.message : "Runtime action failed.");
    }
  }

  async function updateThreadFlag(
    patch: Partial<{ is_pinned: boolean; is_saved: boolean; is_archived: boolean }>
  ) {
    if (!threadId) {
      setError("Start the conversation before changing thread status.");
      return;
    }
    setError(null);
    try {
      const res = await fetch("/api/atlas/thread", {
        method: "PATCH",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ thread_id: threadId, ...patch }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.message ?? data.error ?? "Thread update failed.");
        return;
      }
      if (typeof patch.is_pinned === "boolean") {
        setThreadFlags((prev) => ({ ...prev, is_pinned: patch.is_pinned! }));
      }
      if (typeof patch.is_saved === "boolean") {
        setThreadFlags((prev) => ({ ...prev, is_saved: patch.is_saved! }));
      }
      if (patch.is_archived) {
        router.replace("/atlas");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Thread update failed.");
    }
  }

  return (
    <div
      data-atlas-fullbleed
      className="flex h-full min-h-0 max-h-full w-full overflow-hidden"
    >
      {/* Left: Projects */}
      <div className={cn("flex min-h-0 flex-col border-r border-accent-champagne/10 bg-white/60 dark:bg-ink-950/60 backdrop-blur-xl transition-all duration-200", leftOpen ? "w-72 shrink-0 xl:w-80" : "w-0 overflow-hidden")}>
        <div className="flex items-center justify-between gap-2 border-b border-ink-200 dark:border-ink-800 px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-gradient">Atlas workspace</span>
          <button type="button" onClick={() => setLeftOpen(false)} className="text-ink-500 dark:text-ink-500 hover:text-ink-800 dark:hover:text-ink-200"><ChevronsLeft size={12} /></button>
        </div>
        <AtlasProjectsPanel
          ownerId={ownerId}
          organizationId={organizationId}
          projects={projects}
          knowledgeCollections={knowledgeCollections}
          projectAccess={projectAccess}
          recentThreads={recentThreads}
          selectedProjectId={selectedProjectId}
          onSelectProject={selectProject}
        />
      </div>
      {!leftOpen && (
        <button type="button" onClick={() => setLeftOpen(true)} title="Open projects"
          className="flex w-8 shrink-0 flex-col items-center justify-center gap-1 border-r border-accent-champagne/10 bg-white/50 dark:bg-ink-950/50 text-ink-500 dark:text-ink-400 transition hover:bg-white/50 dark:hover:bg-ink-900/50 hover:text-accent-champagne">
          <PanelLeft size={13} />
        </button>
      )}

      {/* Center: Chat */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-accent-champagne/10 bg-white/70 dark:bg-ink-950/70 px-4 py-2 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span aria-hidden className="flex h-7 w-20 shrink-0 items-center rounded-md border border-accent-gold/25 bg-white/50 dark:bg-ink-950/50 px-1.5" title="LegendsOS · Atlas">
              <img
                src="/assets/logos/legends-os-logo.png"
                alt=""
                className="h-5 w-full object-contain"
              />
            </span>
            <div className="flex min-w-0 items-baseline gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gold-gradient">Atlas</span>
              <span className="text-ink-900 dark:text-ink-700">·</span>
              <p className="truncate text-xs font-medium text-ink-900 dark:text-ink-100">{currentThread?.title ?? "New conversation"}</p>
              {currentProject && (
                <>
                  <span className="hidden text-ink-900 dark:text-ink-700 sm:inline">·</span>
                  <span className="hidden max-w-[16rem] items-center gap-1 truncate rounded-full border border-accent-gold/25 bg-accent-gold/10 px-2 py-0.5 text-[10px] text-accent-gold sm:inline-flex">
                    <Layers3 size={10} />
                    {currentProject.name}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThreadControlButton
              icon={Pin}
              label={threadFlags.is_pinned ? "Pinned" : "Pin"}
              active={threadFlags.is_pinned}
              disabled={!threadId}
              onClick={() => updateThreadFlag({ is_pinned: !threadFlags.is_pinned })}
            />
            <ThreadControlButton
              icon={Save}
              label={threadFlags.is_saved ? "Saved" : "Save"}
              active={threadFlags.is_saved}
              disabled={!threadId}
              onClick={() => updateThreadFlag({ is_saved: !threadFlags.is_saved })}
            />
            <ThreadControlButton
              icon={Archive}
              label="Archive"
              disabled={!threadId}
              onClick={() => updateThreadFlag({ is_archived: true })}
            />
            <ProviderModelChip provider={provider} setProvider={setProvider} model={model} setModel={setModel} providerCatalog={providerCatalog} modelCatalog={modelCatalog} />
            <button type="button" onClick={() => setRightOpen((o) => !o)} title={rightOpen ? "Close resources" : "Open resources"}
              className={cn("grid h-7 w-7 place-items-center rounded-full border border-ink-200/80 dark:border-ink-700/80 bg-white/50 dark:bg-ink-950/50 text-ink-600 dark:text-ink-300 backdrop-blur-sm transition hover:border-accent-champagne/60 hover:text-accent-champagne", rightOpen && "border-accent-champagne/40 text-accent-champagne")}>
              <PanelRight size={13} />
            </button>
          </div>
        </div>
        <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 scrollbar-thin">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
            {messages.length === 0 && <EmptyChat provider={provider} configured={Boolean(providerEntry?.configured)} onPick={injectPrompt} />}
            {messages.map((m) => <MessageRow key={m.id} message={m} />)}
            {isPending && <div className="flex items-center gap-2 text-xs text-ink-600 dark:text-ink-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-gold" />Atlas is thinking…</div>}
          </div>
        </div>
        <div className="shrink-0 border-t border-accent-champagne/10 bg-white/80 dark:bg-ink-950/80 px-3 pb-4 pt-3 backdrop-blur-xl sm:px-6">
          <div className="mx-auto w-full max-w-7xl">
            {error && <p className="mb-2 rounded-lg border border-status-err/30 bg-status-err/10 px-3 py-2 text-xs text-status-err">{error}</p>}
            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1">
                {attachments.map((file, i) => (
                  <span key={i} className="chip">{truncate(file.name, 28)}<button type="button" className="text-ink-600 dark:text-ink-300 hover:text-status-err" onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}><Trash2 size={10} /></button></span>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2 rounded-2xl border border-accent-champagne/20 bg-white/60 dark:bg-ink-950/60 px-2 py-1.5 shadow-glass backdrop-blur-xl focus-within:border-accent-champagne/40">
              <label className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 hover:text-ink-900 dark:hover:text-ink-100" title="Attach file">
                <Paperclip size={15} />
                <input type="file" multiple hidden onChange={(e) => handleAttach(e.target.files)} />
              </label>
              <button
                type="button"
                onClick={captureScreen}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800 hover:text-ink-900 dark:hover:text-ink-100"
                title="Capture screen/window in the desktop app or a supported browser"
              >
                <MonitorUp size={15} />
              </button>
              <textarea ref={composerRef} className="max-h-[40vh] min-h-[40px] flex-1 resize-none bg-transparent px-1 py-2 text-sm text-ink-900 dark:text-ink-100 outline-none placeholder:text-ink-500 dark:placeholder:text-ink-400" placeholder="Ask Atlas. Paste screenshots or attach files. Enter to send, Shift+Enter for a new line." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKey} onPaste={handlePaste} disabled={isPending} rows={1}
                onInput={(e) => { const el = e.target as HTMLTextAreaElement; el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 320)}px`; }} />
              <button onClick={send} className="btn-primary h-9 shrink-0 px-3" disabled={isPending || (!input.trim() && attachments.length === 0)} aria-label="Send message"><Send size={14} /><span className="hidden sm:inline">Send</span></button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-ink-500 dark:text-ink-400">
              via <span className="text-ink-600 dark:text-ink-300">{provider}</span>
              {model && <> · <span className="text-ink-600 dark:text-ink-300">{truncate(model.split("/").slice(-1)[0], 40)}</span></>}
              {currentProject && <> · <span className="text-accent-gold">{truncate(currentProject.name, 36)}</span></>}
            </p>
          </div>
        </div>
      </div>

      {/* Right: Sources and action resources */}
      <div className={cn("flex min-h-0 flex-col border-l border-accent-champagne/10 bg-white/60 dark:bg-ink-950/60 backdrop-blur-xl transition-all duration-200", rightOpen ? "w-72 shrink-0 xl:w-80" : "w-0 overflow-hidden")}>
        <div className="flex items-center justify-between gap-2 border-b border-ink-200 dark:border-ink-800 px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-600 dark:text-ink-300">Resources</span>
          <button type="button" onClick={() => setRightOpen(false)} className="text-ink-500 dark:text-ink-500 hover:text-ink-800 dark:hover:text-ink-200"><ChevronsRight size={12} /></button>
        </div>
        <WorkspaceResourcePanel
          messages={messages}
          currentProject={currentProject}
          loanContext={loanContext}
          runtimeContext={runtimeContext}
          actionMessage={contextAction}
          onPrompt={injectPrompt}
          onRuntimeAction={runRuntimeAction}
        />
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import {
  Brain,
  ChevronDown,
  ChevronUp,
  Loader2,
  Send,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";

type AgentType =
  | "owner_atlas"
  | "lo_atlas"
  | "processor_flo"
  | "coordinator_agent"
  | "builder_agent"
  | "marketing_agent"
  | "academy_agent"
  | "media_agent"
  | "social_agent"
  | "docs_agent"
  | "ux_agent";

interface ContextSource {
  label: string;
  detail: string;
}

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

interface LastMeta {
  provider: string;
  model: string;
  contextSources: ContextSource[];
  skillsUsed: string[];
  toolsCalled: string[];
  degraded: boolean;
}

interface BrowserContext {
  source_url?: string | null;
  source_title?: string | null;
  selected_text?: string | null;
  structured?: Record<string, unknown> | null;
}

export interface AgentChatProps {
  agentType: AgentType;
  agentName: string;
  agentRole: string;
  /** Optional pre-filled context from the Browser Companion / a handoff. */
  browserContext?: BrowserContext | null;
  /** Optional starter prompt to seed the composer. */
  seedPrompt?: string;
  loanId?: string | null;
  /** Compact mode for side-panels. */
  compact?: boolean;
}

const HANDOFF_TARGETS: { value: AgentType; label: string }[] = [
  { value: "owner_atlas", label: "Atlas (Owner)" },
  { value: "lo_atlas", label: "Atlas (LO)" },
  { value: "processor_flo", label: "FLO (Processing)" },
  { value: "coordinator_agent", label: "Coordinator" },
  { value: "builder_agent", label: "Builder" },
  { value: "marketing_agent", label: "Marketing" },
];

export function AgentChat({
  agentType,
  agentName,
  agentRole,
  browserContext,
  seedPrompt,
  loanId,
  compact,
}: AgentChatProps) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState(seedPrompt ?? "");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [last, setLast] = useState<LastMeta | null>(null);
  const [degradedSeen, setDegradedSeen] = useState(false);
  const [setupNeeded, setSetupNeeded] = useState<string | null>(null);
  const [showContext, setShowContext] = useState(!compact);
  const [skillOpen, setSkillOpen] = useState(false);
  const [skillSuggest, setSkillSuggest] = useState<string | null>(null);
  const [skillName, setSkillName] = useState("");
  const [skillSteps, setSkillSteps] = useState("");
  const [savingSkill, setSavingSkill] = useState(false);
  const [skillSaved, setSkillSaved] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const usedBrowserContext = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, sending]);

  async function send() {
    const message = input.trim();
    if (!message || sending) return;
    setSending(true);
    setSetupNeeded(null);
    setSkillSaved(null);
    setTurns((t) => [...t, { role: "user", content: message }]);
    setInput("");

    // Browser context is attached to the FIRST message of a session only.
    const attachBrowser = browserContext && !usedBrowserContext.current ? browserContext : null;
    if (attachBrowser) usedBrowserContext.current = true;

    try {
      const res = await fetch("/api/agents/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agent_type: agentType,
          message,
          session_id: sessionId,
          loan_id: loanId ?? null,
          browser_context: attachBrowser,
          origin: attachBrowser ? "browser_companion" : "web",
        }),
      });
      const data = await res.json();

      if (!data.ok) {
        if (data.setupNeeded) {
          setSetupNeeded(
            data.envVar
              ? `${agentName} is ready, but no AI model is connected yet (${data.envVar}). Ask the owner to configure a provider in Settings.`
              : data.message || "No AI model is connected yet. Configure a provider in Settings."
          );
        } else {
          setTurns((t) => [...t, { role: "assistant", content: `⚠️ ${data.message || "Something went wrong."}` }]);
        }
        return;
      }

      setSessionId(data.sessionId ?? sessionId);
      setTurns((t) => [...t, { role: "assistant", content: data.content }]);
      setLast({
        provider: data.provider,
        model: data.model,
        contextSources: data.contextSources ?? [],
        skillsUsed: data.skillsUsed ?? [],
        toolsCalled: data.toolsCalled ?? [],
        degraded: !!data.degraded,
      });
      if (data.degraded) setDegradedSeen(true);
      if (data.skillSuggestion?.explicit) {
        setSkillSuggest(data.skillSuggestion.proposedName);
        setSkillName(data.skillSuggestion.proposedName);
        setSkillOpen(true);
      }
    } catch {
      setTurns((t) => [...t, { role: "assistant", content: "⚠️ Network error reaching the agent." }]);
    } finally {
      setSending(false);
    }
  }

  async function saveSkill() {
    if (!skillName.trim() || savingSkill) return;
    setSavingSkill(true);
    try {
      const res = await fetch("/api/agents/skills", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agent_type: agentType,
          skill_name: skillName.trim(),
          steps: skillSteps.split("\n").map((s) => s.trim()).filter(Boolean),
          source_examples: turns.slice(-4).map((t) => `${t.role}: ${t.content}`),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSkillSaved(`Saved skill "${data.skill?.skill_name ?? skillName}".`);
        setSkillOpen(false);
        setSkillSuggest(null);
        setSkillSteps("");
      } else if (data.table_missing) {
        setSkillSaved("Skill not saved — agent tables aren't applied yet (setup needed).");
      } else {
        setSkillSaved(`Couldn't save skill: ${data.message ?? "error"}.`);
      }
    } catch {
      setSkillSaved("Network error saving skill.");
    } finally {
      setSavingSkill(false);
    }
  }

  async function handoff(to: AgentType) {
    if (to === agentType) return;
    try {
      await fetch("/api/agents/handoff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          from_agent_type: agentType,
          to_agent_type: to,
          from_session_id: sessionId,
          reason: "manual handoff",
          context_summary: turns.slice(-3).map((t) => `${t.role}: ${t.content}`).join("\n").slice(0, 1800),
        }),
      });
      setTurns((t) => [...t, { role: "assistant", content: `↪︎ Handed this off to ${HANDOFF_TARGETS.find((h) => h.value === to)?.label ?? to}. They'll see it in their queue.` }]);
    } catch {
      /* best-effort */
    }
  }

  function clearSession() {
    setTurns([]);
    setSessionId(null);
    setLast(null);
    setSetupNeeded(null);
    setSkillSaved(null);
    usedBrowserContext.current = false;
  }

  return (
    <div className="flex h-full min-h-[480px] flex-col rounded-2xl border border-ink-200 bg-white/70 dark:border-ink-800 dark:bg-ink-950/40">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-ink-200 px-4 py-3 dark:border-ink-800">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-accent-gold/30 bg-accent-gold/10 text-accent-gold">
            <Sparkles size={16} />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">{agentName}</p>
            <p className="text-[11px] text-ink-500 dark:text-ink-400">{agentRole}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="chip chip-ok text-[10px]">Drafts only · never sends</span>
          <button onClick={clearSession} className="btn-ghost text-xs" title="Clear session">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Context panel */}
      <div className="border-b border-ink-200 px-4 py-2 dark:border-ink-800">
        <button
          onClick={() => setShowContext((v) => !v)}
          className="flex w-full items-center justify-between text-[11px] font-medium uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400"
        >
          <span className="flex items-center gap-1.5"><Brain size={12} /> Context loaded</span>
          {showContext ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {showContext && (
          <div className="mt-2 space-y-1.5 text-[11px] text-ink-600 dark:text-ink-300">
            {last ? (
              <>
                <Row label="Memory + skills">
                  {last.contextSources.length
                    ? last.contextSources.map((s) => `${s.label} (${s.detail})`).join(", ")
                    : "none loaded yet"}
                </Row>
                <Row label="Skills used">{last.skillsUsed.length ? last.skillsUsed.join(", ") : "—"}</Row>
                <Row label="Tools called">{last.toolsCalled.length ? last.toolsCalled.join(", ") : "—"}</Row>
                <Row label="Model">{last.provider} · {last.model}</Row>
                <Row label="Permissions">Read context + create drafts. No live send/publish/Drive.</Row>
              </>
            ) : (
              <p className="text-ink-500 dark:text-ink-400">Send a message — loaded memory, skills, and tools appear here.</p>
            )}
            {degradedSeen && (
              <p className="rounded-md border border-status-warn/30 bg-status-warn/10 px-2 py-1 text-status-warn">
                Memory persistence is in setup-needed mode (migration not applied). Chat works; nothing is saved yet.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {turns.length === 0 && !setupNeeded && (
          <p className="text-sm text-ink-500 dark:text-ink-400">
            Ask {agentName} anything. {agentRole}.
          </p>
        )}
        {turns.map((t, i) => (
          <div key={i} className={t.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                t.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-br-sm bg-accent-gold/15 px-3 py-2 text-sm text-ink-900 dark:text-ink-100"
                  : "max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 dark:border-ink-800 dark:bg-ink-900/50 dark:text-ink-200"
              }
            >
              {t.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex items-center gap-2 text-xs text-ink-500 dark:text-ink-400">
            <Loader2 size={14} className="animate-spin" /> {agentName} is thinking…
          </div>
        )}
        {setupNeeded && (
          <div className="rounded-lg border border-status-info/30 bg-status-info/10 px-3 py-2 text-sm text-status-info">
            {setupNeeded}
          </div>
        )}
        {skillSaved && (
          <div className="rounded-lg border border-accent-gold/30 bg-accent-gold/10 px-3 py-2 text-xs text-accent-gold">
            {skillSaved}
          </div>
        )}
      </div>

      {/* Skill draft */}
      {skillOpen && (
        <div className="border-t border-ink-200 bg-ink-50/60 px-4 py-3 dark:border-ink-800 dark:bg-ink-950/60">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-ink-700 dark:text-ink-200">
            <Wand2 size={13} /> {skillSuggest ? "Save this as a reusable skill?" : "New skill"}
          </p>
          <input
            value={skillName}
            onChange={(e) => setSkillName(e.target.value)}
            placeholder="Skill name"
            className="mb-2 w-full rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm text-ink-900 outline-none focus:border-accent-gold/60 dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-100"
          />
          <textarea
            value={skillSteps}
            onChange={(e) => setSkillSteps(e.target.value)}
            placeholder="Steps (one per line) — optional"
            rows={3}
            className="mb-2 w-full rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm text-ink-900 outline-none focus:border-accent-gold/60 dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-100"
          />
          <div className="flex gap-2">
            <button onClick={saveSkill} disabled={savingSkill} className="btn btn-primary text-xs">
              {savingSkill ? "Saving…" : "Save skill"}
            </button>
            <button onClick={() => setSkillOpen(false)} className="btn-ghost text-xs">Cancel</button>
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="border-t border-ink-200 px-3 py-3 dark:border-ink-800">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={`Message ${agentName}…`}
            rows={compact ? 2 : 3}
            className="flex-1 resize-none rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none focus:border-accent-gold/60 dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-100"
          />
          <button onClick={send} disabled={sending || !input.trim()} className="btn btn-primary h-10 px-3">
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <button
            onClick={() => { setSkillSuggest(null); setSkillName(""); setSkillOpen((v) => !v); }}
            className="btn-ghost text-[11px]"
          >
            <Wand2 size={12} /> Save as skill
          </button>
          <label className="flex items-center gap-1 text-[11px] text-ink-500 dark:text-ink-400">
            Hand off to
            <select
              onChange={(e) => { if (e.target.value) handoff(e.target.value as AgentType); e.currentTarget.selectedIndex = 0; }}
              className="rounded-md border border-ink-200 bg-white px-1.5 py-0.5 text-[11px] text-ink-700 dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-200"
              defaultValue=""
            >
              <option value="">choose…</option>
              {HANDOFF_TARGETS.filter((h) => h.value !== agentType).map((h) => (
                <option key={h.value} value={h.value}>{h.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="w-24 shrink-0 text-ink-400 dark:text-ink-500">{label}</span>
      <span className="flex-1 text-ink-700 dark:text-ink-200">{children}</span>
    </div>
  );
}

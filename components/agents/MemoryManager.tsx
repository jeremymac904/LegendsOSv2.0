"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

interface AgentOption {
  value: string;
  label: string;
}

interface Memory {
  id: string;
  agent_type: string;
  category: string;
  title: string;
  body: string;
  confidence: string;
  priority: string;
  is_active: boolean;
  updated_at: string;
}

const CATEGORIES = [
  "profile_preference",
  "tone_preference",
  "workflow_preference",
  "borrower_workflow",
  "document_workflow",
  "email_workflow",
  "social_workflow",
  "loan_condition_workflow",
  "drive_folder_workflow",
  "prompt_pattern",
  "saved_instruction",
  "personal_rule",
  "assistant_note",
];

export function MemoryManager({ agentTypes }: { agentTypes: AgentOption[] }) {
  const [agentType, setAgentType] = useState(agentTypes[0]?.value ?? "lo_atlas");
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("personal_rule");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/agents/memory?agent_type=${agentType}`);
      const data = await res.json();
      setMemories(data.memories ?? []);
      setTableMissing(!!data.table_missing);
    } catch {
      setMemories([]);
    } finally {
      setLoading(false);
    }
  }, [agentType]);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/agents/memory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agent_type: agentType, category, title: title.trim(), body: body.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setTitle("");
        setBody("");
        await load();
      } else if (data.table_missing) {
        setTableMissing(true);
      }
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(id: string) {
    await fetch("/api/agents/memory", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "deactivate", id }),
    });
    setMemories((m) => m.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-ink-500 dark:text-ink-400">Agent brain</label>
        <select
          value={agentType}
          onChange={(e) => setAgentType(e.target.value)}
          className="rounded-lg border border-ink-200 bg-white px-2 py-1 text-sm text-ink-900 dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-100"
        >
          {agentTypes.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>
      </div>

      {tableMissing && (
        <p className="rounded-lg border border-status-warn/30 bg-status-warn/10 px-3 py-2 text-xs text-status-warn">
          Agent memory tables aren&apos;t applied yet — saving is in setup-needed mode. Apply the agent_runtime migration to persist.
        </p>
      )}

      <div className="rounded-xl border border-ink-200 bg-white/60 p-3 dark:border-ink-800 dark:bg-ink-950/40">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">Add a memory / rule</p>
        <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-sm text-ink-900 dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-100"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
            ))}
          </select>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Always separate FHA conditions by category"
            className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm text-ink-900 dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-100"
          />
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Optional detail…"
          rows={2}
          className="mt-2 w-full rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm text-ink-900 dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-100"
        />
        <button onClick={add} disabled={saving || !title.trim()} className="btn btn-primary mt-2 text-xs">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Save memory
        </button>
      </div>

      <div className="space-y-2">
        {loading ? (
          <p className="text-sm text-ink-500 dark:text-ink-400">Loading…</p>
        ) : memories.length === 0 ? (
          <p className="text-sm text-ink-500 dark:text-ink-400">No memories yet for this agent.</p>
        ) : (
          memories.map((m) => (
            <div key={m.id} className="flex items-start justify-between gap-3 rounded-lg border border-ink-200 bg-white/60 px-3 py-2 dark:border-ink-800 dark:bg-ink-950/30">
              <div className="min-w-0">
                <p className="text-sm text-ink-900 dark:text-ink-100">{m.title}</p>
                {m.body && <p className="text-xs text-ink-600 dark:text-ink-300">{m.body}</p>}
                <span className="chip mt-1 text-[10px]">{m.category.replace(/_/g, " ")}</span>
              </div>
              <button onClick={() => deactivate(m.id)} className="btn-ghost text-xs" title="Deactivate">
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

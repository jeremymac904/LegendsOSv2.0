"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Power, Share2 } from "lucide-react";

interface AgentOption {
  value: string;
  label: string;
}

interface Skill {
  id: string;
  agent_type: string;
  skill_name: string;
  description: string | null;
  steps: string[];
  usage_count: number;
  last_used_at: string | null;
  is_active: boolean;
  is_shared_with_team: boolean;
}

export function SkillManager({
  agentTypes,
  admin = false,
}: {
  agentTypes: AgentOption[];
  admin?: boolean;
}) {
  const [agentType, setAgentType] = useState(agentTypes[0]?.value ?? "lo_atlas");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [steps, setSteps] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/agents/skills?agent_type=${agentType}`);
      const data = await res.json();
      setSkills(data.skills ?? []);
      setTableMissing(!!data.table_missing);
    } catch {
      setSkills([]);
    } finally {
      setLoading(false);
    }
  }, [agentType]);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/agents/skills", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agent_type: agentType,
          skill_name: name.trim(),
          description: desc.trim() || undefined,
          steps: steps.split("\n").map((s) => s.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setName("");
        setDesc("");
        setSteps("");
        await load();
      } else if (data.table_missing) {
        setTableMissing(true);
      }
    } finally {
      setSaving(false);
    }
  }

  async function patch(id: string, action: "promote" | "deactivate" | "activate") {
    await fetch("/api/agents/skills", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, id }),
    });
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-ink-500 dark:text-ink-400">Agent</label>
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
          Agent skill tables aren&apos;t applied yet — saving is in setup-needed mode. Apply the agent_runtime migration to persist.
        </p>
      )}

      {!admin && (
        <div className="rounded-xl border border-ink-200 bg-white/60 p-3 dark:border-ink-800 dark:bg-ink-950/40">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">Create a skill</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Skill name — e.g. FHA condition plan"
            className="mb-2 w-full rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm text-ink-900 dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-100"
          />
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Description (optional)"
            className="mb-2 w-full rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm text-ink-900 dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-100"
          />
          <textarea
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            placeholder="Steps (one per line)"
            rows={3}
            className="mb-2 w-full rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm text-ink-900 dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-100"
          />
          <button onClick={add} disabled={saving || !name.trim()} className="btn btn-primary text-xs">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Save skill
          </button>
        </div>
      )}

      <div className="space-y-2">
        {loading ? (
          <p className="text-sm text-ink-500 dark:text-ink-400">Loading…</p>
        ) : skills.length === 0 ? (
          <p className="text-sm text-ink-500 dark:text-ink-400">No skills yet for this agent.</p>
        ) : (
          skills.map((s) => (
            <div key={s.id} className="rounded-lg border border-ink-200 bg-white/60 px-3 py-2 dark:border-ink-800 dark:bg-ink-950/30">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink-900 dark:text-ink-100">
                    {s.skill_name}{" "}
                    {s.is_shared_with_team && <span className="chip chip-ok text-[10px]">team</span>}
                    {!s.is_active && <span className="chip chip-off text-[10px]">inactive</span>}
                  </p>
                  {s.description && <p className="text-xs text-ink-600 dark:text-ink-300">{s.description}</p>}
                  <p className="mt-0.5 text-[11px] text-ink-400 dark:text-ink-500">Used {s.usage_count}×{s.steps?.length ? ` · ${s.steps.length} steps` : ""}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {admin && !s.is_shared_with_team && (
                    <button onClick={() => patch(s.id, "promote")} className="btn-ghost text-xs" title="Promote to team">
                      <Share2 size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => patch(s.id, s.is_active ? "deactivate" : "activate")}
                    className="btn-ghost text-xs"
                    title={s.is_active ? "Deactivate" : "Activate"}
                  >
                    <Power size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

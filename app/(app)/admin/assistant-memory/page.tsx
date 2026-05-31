import { redirect } from "next/navigation";
import { Brain } from "lucide-react";

import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { getEffectiveProfile } from "@/lib/impersonation";
import { isOwner } from "@/lib/permissions";
import {
  getSupabaseServiceClient,
  isMissingDatabaseObjectError,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface MemoryRow {
  id: string;
  user_id: string;
  agent_type: string;
  category: string;
  title: string;
  updated_at: string;
}
interface EventRow {
  id: string;
  user_id: string;
  agent_type: string;
  event_type: string;
  event_summary: string | null;
  created_at: string;
}

async function loadAudit(): Promise<{
  memories: MemoryRow[];
  events: EventRow[];
  emails: Record<string, string>;
  tableMissing: boolean;
}> {
  try {
    const service = getSupabaseServiceClient();
    const [{ data: memories, error: memErr }, { data: events }, { data: profiles }] =
      await Promise.all([
        service.from("agent_memories").select("id,user_id,agent_type,category,title,updated_at").order("updated_at", { ascending: false }).limit(200),
        service.from("agent_memory_events").select("id,user_id,agent_type,event_type,event_summary,created_at").order("created_at", { ascending: false }).limit(100),
        service.from("profiles").select("id,email"),
      ]);
    if (memErr && isMissingDatabaseObjectError(memErr)) {
      return { memories: [], events: [], emails: {}, tableMissing: true };
    }
    const emails: Record<string, string> = {};
    for (const p of (profiles ?? []) as { id: string; email: string }[]) emails[p.id] = p.email;
    return {
      memories: (memories ?? []) as MemoryRow[],
      events: (events ?? []) as EventRow[],
      emails,
      tableMissing: false,
    };
  } catch (error) {
    return { memories: [], events: [], emails: {}, tableMissing: isMissingDatabaseObjectError(error) };
  }
}

export default async function AdminAssistantMemoryPage() {
  const { profile } = await getEffectiveProfile();
  if (!profile || !isOwner(profile)) redirect("/dashboard");

  const { memories, events, emails, tableMissing } = await loadAudit();

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Owner · Admin"
        title="Agent Memory Audit"
        description="Read-only audit of agent memory across the team. Private memory content stays with its owner; this view is for safety oversight only."
        action={<StatusPill status="ok" label="owner" />}
      />

      {tableMissing && (
        <div className="card-padded">
          <p className="text-sm text-status-warn">
            Agent runtime tables aren&apos;t applied yet. Apply the <code>agent_runtime</code> migration to enable the audit.
          </p>
        </div>
      )}

      <section className="card-padded">
        <div className="section-title">
          <div>
            <h2>Recent memory writes ({events.length})</h2>
            <p>Who taught which agent what, and when.</p>
          </div>
          <Brain size={18} className="text-accent-gold" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-100 text-[10px] uppercase tracking-[0.18em] text-ink-600 dark:bg-ink-950/50 dark:text-ink-300">
              <tr>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Agent</th>
                <th className="px-3 py-2">Event</th>
                <th className="px-3 py-2">Summary</th>
                <th className="px-3 py-2">When</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-4 text-ink-500 dark:text-ink-400">No memory events yet.</td></tr>
              ) : (
                events.map((e) => (
                  <tr key={e.id} className="border-t border-ink-200 dark:border-ink-800">
                    <td className="px-3 py-2 text-ink-700 dark:text-ink-200">{emails[e.user_id] ?? e.user_id.slice(0, 8)}</td>
                    <td className="px-3 py-2"><span className="chip text-[10px]">{e.agent_type}</span></td>
                    <td className="px-3 py-2 text-ink-600 dark:text-ink-300">{e.event_type}</td>
                    <td className="px-3 py-2 text-ink-600 dark:text-ink-300">{e.event_summary ?? "—"}</td>
                    <td className="px-3 py-2 text-ink-500 dark:text-ink-400">{new Date(e.created_at).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card-padded">
        <div className="section-title">
          <div>
            <h2>Active memories ({memories.length})</h2>
            <p>Titles only — content is not surfaced cross-user.</p>
          </div>
          <StatusPill status="info" label="titles only" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-100 text-[10px] uppercase tracking-[0.18em] text-ink-600 dark:bg-ink-950/50 dark:text-ink-300">
              <tr>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Agent</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Title</th>
              </tr>
            </thead>
            <tbody>
              {memories.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-4 text-ink-500 dark:text-ink-400">No memories yet.</td></tr>
              ) : (
                memories.map((m) => (
                  <tr key={m.id} className="border-t border-ink-200 dark:border-ink-800">
                    <td className="px-3 py-2 text-ink-700 dark:text-ink-200">{emails[m.user_id] ?? m.user_id.slice(0, 8)}</td>
                    <td className="px-3 py-2"><span className="chip text-[10px]">{m.agent_type}</span></td>
                    <td className="px-3 py-2 text-ink-600 dark:text-ink-300">{m.category.replace(/_/g, " ")}</td>
                    <td className="px-3 py-2 text-ink-700 dark:text-ink-200">{m.title}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

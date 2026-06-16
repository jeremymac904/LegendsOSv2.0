"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  GraduationCap,
  Trophy,
  Users,
} from "lucide-react";

interface Member {
  id: string;
  name: string;
  role: string;
  lastActiveAt: string | null;
  active: boolean;
  scorecardSubmitted: boolean;
  submittedRecently: boolean;
  weeksDone: number;
  graduated: boolean;
  needsFollowUp: boolean;
}
interface TeamData {
  summary: { total: number; active: number; needsFollowUp: number; graduated: number };
  members: Member[];
  teamWins: { author: string; title: string; body: string; createdAt: string }[];
  recentActivity: { author: string; category: string; title: string; createdAt: string }[];
}

const roleLabel = (r: string) =>
  ({ loan_officer: "Loan Officer", owner: "Owner", admin: "Admin", processor: "Processor", coordinator: "Coordinator", marketing: "Marketing" }[r] ?? r);

const ago = (iso: string | null): string => {
  if (!iso) return "no activity yet";
  const d = Date.now() - new Date(iso).getTime();
  const days = Math.floor(d / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
};

function Stat({ icon: Icon, label, value, tone }: { icon: typeof Users; label: string; value: number; tone?: string }) {
  return (
    <div className="glass-card-padded">
      <div className="flex items-center gap-2">
        <span className={"grid h-8 w-8 place-items-center rounded-lg border border-accent-champagne/20 bg-accent-gold/10 " + (tone ?? "text-accent-champagne")}>
          <Icon size={15} />
        </span>
        <p className="text-[10px] uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-ink-900 dark:text-ink-100">{value}</p>
    </div>
  );
}

export function TeamActivityDashboard() {
  const [data, setData] = useState<TeamData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/academy/team", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (!alive) return;
        if (json?.ok) setData(json as TeamData);
        else setError(true);
      } catch {
        if (alive) setError(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) return <p className="text-sm text-ink-500 dark:text-ink-400">Loading team activity…</p>;
  if (error || !data)
    return <p className="text-sm text-status-err">Could not load team activity.</p>;

  const followUps = data.members.filter((m) => m.needsFollowUp);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Users} label="Team" value={data.summary.total} />
        <Stat icon={Activity} label="Active (7d)" value={data.summary.active} tone="text-status-ok" />
        <Stat icon={AlertTriangle} label="Needs follow-up" value={data.summary.needsFollowUp} tone="text-accent-orange" />
        <Stat icon={GraduationCap} label="Graduated" value={data.summary.graduated} tone="text-accent-gold" />
      </div>

      {/* Needs coaching follow-up */}
      <section className="space-y-3">
        <div className="section-title">
          <h2 className="flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-accent-orange" /> Needs coaching follow-up
          </h2>
          <p>Inactive this week, or no scorecard submitted.</p>
        </div>
        {followUps.length === 0 ? (
          <p className="glass-card-padded text-sm text-status-ok">Everyone is active and on track. 🎯</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {followUps.map((m) => (
              <span key={m.id} className="inline-flex items-center gap-2 rounded-full border border-accent-orange/30 bg-accent-orange/10 px-3 py-1.5 text-[12px] text-ink-900 dark:text-ink-100">
                <span className="font-medium">{m.name}</span>
                <span className="text-ink-500 dark:text-ink-400">
                  {!m.active ? `quiet · ${ago(m.lastActiveAt)}` : "no scorecard"}
                </span>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Roster */}
      <section className="space-y-3">
        <div className="section-title">
          <h2 className="flex items-center gap-1.5">
            <Users size={14} className="text-accent-champagne" /> Team roster
          </h2>
          <p>Activity, progress, and scorecard status across the team.</p>
        </div>
        <div className="-mx-1 overflow-x-auto px-1 scrollbar-thin">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-accent-champagne/20">
                {["Member", "Role", "Status", "Last active", "Weeks", "Scorecard"].map((h) => (
                  <th key={h} className="px-2 py-2.5"><span className="label whitespace-nowrap">{h}</span></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.members.map((m) => (
                <tr key={m.id} className="border-b border-ink-200/70 dark:border-accent-champagne/10">
                  <td className="px-2 py-2.5 font-medium text-ink-900 dark:text-ink-100">{m.name}{m.graduated && <GraduationCap size={12} className="ml-1 inline text-accent-gold" />}</td>
                  <td className="px-2 py-2.5 text-ink-600 dark:text-ink-300">{roleLabel(m.role)}</td>
                  <td className="px-2 py-2.5">
                    {m.active ? (
                      <span className="inline-flex items-center gap-1 text-[12px] text-status-ok"><span className="h-1.5 w-1.5 rounded-full bg-status-ok" />Active</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[12px] text-ink-500 dark:text-ink-400"><span className="h-1.5 w-1.5 rounded-full bg-ink-500" />Quiet</span>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-ink-600 dark:text-ink-300">{ago(m.lastActiveAt)}</td>
                  <td className="px-2 py-2.5 tabular-nums text-ink-700 dark:text-ink-200">{m.weeksDone}/12</td>
                  <td className="px-2 py-2.5">
                    {m.submittedRecently ? (
                      <span className="inline-flex items-center gap-1 text-[12px] text-status-ok"><CheckCircle2 size={12} />This week</span>
                    ) : m.scorecardSubmitted ? (
                      <span className="text-[12px] text-ink-500 dark:text-ink-400">Older</span>
                    ) : (
                      <span className="text-[12px] text-ink-500 dark:text-ink-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Team wins */}
        <section className="space-y-3">
          <div className="section-title">
            <h2 className="flex items-center gap-1.5"><Trophy size={14} className="text-accent-gold" /> Team wins</h2>
            <p>Recent wins posted to the feed.</p>
          </div>
          {data.teamWins.length === 0 ? (
            <p className="glass-card-padded text-sm text-ink-500 dark:text-ink-400">No wins posted yet.</p>
          ) : (
            <div className="space-y-2">
              {data.teamWins.map((w, i) => (
                <div key={i} className="glass-card-padded">
                  <p className="text-[11px] text-ink-500 dark:text-ink-400">{w.author} · {ago(w.createdAt)}</p>
                  <p className="mt-0.5 text-sm font-medium text-ink-900 dark:text-ink-100">{w.title}</p>
                  <p className="mt-1 line-clamp-2 text-[12.5px] text-ink-600 dark:text-ink-300">{w.body}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent activity */}
        <section className="space-y-3">
          <div className="section-title">
            <h2 className="flex items-center gap-1.5"><Activity size={14} className="text-accent-champagne" /> Recent activity</h2>
            <p>Latest posts across the team feed.</p>
          </div>
          {data.recentActivity.length === 0 ? (
            <p className="glass-card-padded text-sm text-ink-500 dark:text-ink-400">No recent activity.</p>
          ) : (
            <ul className="glass-card-padded divide-y divide-accent-champagne/10">
              {data.recentActivity.map((a, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0">
                  <span className="min-w-0 truncate text-[13px] text-ink-800 dark:text-ink-200">
                    <span className="font-medium">{a.author}</span>
                    <span className="text-ink-500 dark:text-ink-400"> · {a.category}</span> — {a.title}
                  </span>
                  <span className="shrink-0 text-[11px] text-ink-500 dark:text-ink-400">{ago(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

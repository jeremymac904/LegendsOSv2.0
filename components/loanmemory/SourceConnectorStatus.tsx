"use client";

// LegendsOS v2 — Source connector status panel (honest, read-only).
//
// Renders the loan-memory source connectors and their TRUE state: Supabase
// (system of record), Gmail intake (dormant), Drive (sample/readonly), the
// Legends Master Pipeline Sheet (placeholder), and the optional Obsidian vault.
// Pure presentational — no I/O. It receives a pre-computed snapshot from the
// server so env values never reach the client (only booleans + notes).

import { cn } from "@/lib/utils";
import type { ConnectorsSnapshot } from "@/lib/loanMemory/connectors";

type Tone = "ok" | "info" | "warn" | "off";

interface Row {
  name: string;
  state: string;
  tone: Tone;
  note: string;
}

const toneChip: Record<Tone, string> = {
  ok: "border-status-ok/30 bg-status-ok/10 text-status-ok",
  info: "border-status-info/30 bg-status-info/10 text-status-info",
  warn: "border-status-warn/30 bg-status-warn/10 text-status-warn",
  off: "border-ink-300/40 bg-ink-200/20 text-ink-600 dark:border-ink-700/50 dark:bg-ink-800/30 dark:text-ink-300",
};

const toneDot: Record<Tone, string> = {
  ok: "bg-status-ok",
  info: "bg-status-info",
  warn: "bg-status-warn",
  off: "bg-ink-400",
};

function buildRows(snap: ConnectorsSnapshot): Row[] {
  const driveTone: Tone = snap.drive.mode === "readonly" ? "info" : "warn";
  return [
    {
      name: "Supabase memory store",
      state: snap.supabaseConfigured ? "Connected · system of record" : "Not configured",
      tone: snap.supabaseConfigured ? "ok" : "warn",
      note: snap.supabaseConfigured
        ? "Loan memory, events, and audit logs persist here (RLS-enforced). Degrades to sample mode if the migration isn't applied."
        : "Supabase env not detected — running in sample mode.",
    },
    {
      name: "Gmail AI Intake",
      state: "Dormant · not activated",
      tone: "off",
      note: snap.gmailIntake.note,
    },
    {
      name: "Google Drive",
      state: snap.drive.mode === "readonly" ? "Read-only (config present)" : "Sample mode",
      tone: driveTone,
      note: snap.drive.note,
    },
    {
      name: "Legends Master Pipeline (Sheet)",
      state: snap.sheet.configured ? "Configured · fallback (not wired)" : "Placeholder",
      tone: snap.sheet.configured ? "info" : "off",
      note: snap.sheet.note,
    },
    {
      name: "Obsidian vault (optional)",
      state: snap.obsidian.configured ? "Configured · mirror (not wired)" : "Optional · inactive",
      tone: snap.obsidian.configured ? "info" : "off",
      note: snap.obsidian.note,
    },
  ];
}

export function SourceConnectorStatus({ snapshot }: { snapshot: ConnectorsSnapshot }) {
  const rows = buildRows(snapshot);

  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-950/40">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold tracking-tight text-ink-900 dark:text-ink-100">
          Source connectors
        </h3>
        <span className="rounded-full border border-ink-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-ink-600 dark:border-ink-700 dark:text-ink-300">
          Read-only · no live calls
        </span>
      </div>

      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.name}
            className="rounded-xl border border-ink-200 bg-ink-50/40 p-3 dark:border-ink-800 dark:bg-ink-900/30"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13px] font-medium text-ink-900 dark:text-ink-100">
                {r.name}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                  toneChip[r.tone]
                )}
              >
                <span
                  aria-hidden
                  className={cn("inline-block h-1.5 w-1.5 rounded-full", toneDot[r.tone])}
                />
                {r.state}
              </span>
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink-600 dark:text-ink-300">
              {r.note}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-3 rounded-xl border border-ink-200 bg-ink-50/40 p-3 dark:border-ink-800 dark:bg-ink-900/30">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-500 dark:text-ink-400">
          Active-loan folder structure
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {snapshot.drive.folderStructure.map((f) => (
            <span
              key={f}
              className="rounded-md border border-ink-200 bg-white px-1.5 py-0.5 text-[11px] text-ink-700 dark:border-ink-700 dark:bg-ink-950/40 dark:text-ink-300"
            >
              {f}
            </span>
          ))}
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
        Nothing here is activated. No Drive or Sheet writes, moves, deletes, or uploads ever
        occur. Gmail intake is dormant and sends nothing.
      </p>
    </div>
  );
}

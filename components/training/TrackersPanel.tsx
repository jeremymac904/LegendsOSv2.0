"use client";

import { useEffect, useRef, useState } from "react";
import { ClipboardCopy, ClipboardList, Download, Plus, X } from "lucide-react";

import { EmptyState } from "@/components/ui/EmptyState";
import {
  loadTrackersRemote,
  saveTrackerRemote,
  type TrackerRowsMap,
} from "@/lib/legends/academyApi";
import {
  trackerStorageKey,
  trackers,
  type TrackerColumn,
  type TrackerConfig,
  type TrackerRow,
} from "@/lib/legends/trackers";
import { cn } from "@/lib/utils";

// Legends Mortgage Academy — Execution Trackers. A generic editable row table
// driven by the configs in lib/legends/trackers.ts: add row, edit cells,
// delete row, CSV export. Rows persist per tracker to localStorage
// (`legendsos:academy:tracker-<key>`) — a lightweight list the LO keeps open
// next to the LOS, not a CRM.

const CELL_CLASS =
  "w-full rounded-lg border border-ink-700/80 bg-ink-950/50 px-2 text-sm text-ink-100 backdrop-blur-sm placeholder:text-ink-400 focus:border-accent-champagne/60 focus:outline-none focus:ring-2 focus:ring-accent-gold/20";

function readRows(storageKey: string): TrackerRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TrackerRow[]) : [];
  } catch {
    return [];
  }
}

function writeRows(storageKey: string, rows: TrackerRow[]) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(rows));
  } catch {
    /* quota / disabled — ignore */
  }
}

function emptyRow(columns: TrackerColumn[]): TrackerRow {
  return Object.fromEntries(columns.map((c) => [c.key, ""]));
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function buildCsv(config: TrackerConfig, rows: TrackerRow[]): string {
  const header = config.columns.map((c) => csvEscape(c.label)).join(",");
  const body = rows
    .map((r) => config.columns.map((c) => csvEscape(r[c.key] ?? "")).join(","))
    .join("\n");
  return `${header}\n${body}\n`;
}

// Plain-text snapshot for pasting into a submitted question or scorecard note.
function buildSnapshot(config: TrackerConfig, rows: TrackerRow[]): string {
  const lines = [`${config.title} snapshot`, `Rows: ${rows.length}`];
  for (const col of config.columns) {
    if (col.kind !== "select") continue;
    const counts: Record<string, number> = {};
    for (const row of rows) {
      const value = (row[col.key] ?? "").trim();
      if (!value) continue;
      counts[value] = (counts[value] ?? 0) + 1;
    }
    const parts = Object.entries(counts).map(([k, v]) => `${k}: ${v}`);
    if (parts.length > 0) lines.push(`${col.label} — ${parts.join(", ")}`);
  }
  return lines.join("\n");
}

interface CellProps {
  column: TrackerColumn;
  value: string;
  onChange: (value: string) => void;
}

function TrackerCell({ column, value, onChange }: CellProps) {
  if (column.kind === "select") {
    return (
      <select
        aria-label={column.label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(CELL_CLASS, "h-9")}
      >
        <option value="" />
        {(column.options ?? []).map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }
  if (column.kind === "long") {
    return (
      <textarea
        aria-label={column.label}
        value={value}
        rows={1}
        onChange={(e) => onChange(e.target.value)}
        className={cn(CELL_CLASS, "min-h-9 py-1.5 leading-relaxed")}
      />
    );
  }
  return (
    <input
      aria-label={column.label}
      type={column.kind === "date" ? "date" : "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(CELL_CLASS, "h-9")}
    />
  );
}

export default function TrackersPanel() {
  const [activeKey, setActiveKey] = useState<string>(trackers[0]?.key ?? "");
  const [rows, setRows] = useState<TrackerRow[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState("Saved to your account.");
  const [copied, setCopied] = useState(false);

  const config = trackers.find((t) => t.key === activeKey) ?? trackers[0];

  // Cloud cache + reachability + debounce timer for write-through to Supabase.
  const remoteRef = useRef<TrackerRowsMap | null>(null);
  const cloudRef = useRef(false);
  const [remoteReady, setRemoteReady] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load all cloud trackers once on mount (null if offline/unauth).
  useEffect(() => {
    let alive = true;
    void loadTrackersRemote().then((map) => {
      if (!alive) return;
      remoteRef.current = map;
      cloudRef.current = map !== null;
      setRemoteReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Load the active tracker's rows — cloud cache if available, else localStorage.
  useEffect(() => {
    if (!config) return;
    const cloud = remoteRef.current?.[config.key];
    setRows(cloud ?? readRows(trackerStorageKey(config.key)));
    setHydrated(true);
    setStatus(cloudRef.current ? "Saved to your account." : "Saved in this browser.");
  }, [config, remoteReady]);

  // Persist edits: localStorage immediately + debounced Supabase upsert.
  useEffect(() => {
    if (!hydrated || !config) return;
    writeRows(trackerStorageKey(config.key), rows);
    if (remoteRef.current) remoteRef.current[config.key] = rows;
    const key = config.key;
    const snapshot = rows;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveTrackerRemote(key, snapshot).then((ok) => {
        if (ok) cloudRef.current = true;
      });
    }, 600);
  }, [hydrated, rows, config]);

  if (!config) return null;

  function addRow() {
    if (!config) return;
    setRows((current) => [...current, emptyRow(config.columns)]);
    setStatus("Row added.");
  }

  function updateCell(index: number, key: string, value: string) {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    );
    setStatus(cloudRef.current ? "Saved to your account." : "Saved in this browser.");
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, i) => i !== index));
    setStatus("Row removed.");
  }

  function exportCsv() {
    if (!config || rows.length === 0) return;
    const blob = new Blob([buildCsv(config, rows)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = config.csvName;
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus(`Exported ${rows.length} row${rows.length === 1 ? "" : "s"} to ${config.csvName}.`);
  }

  async function copySnapshot() {
    if (!config || !navigator.clipboard) return;
    await navigator.clipboard.writeText(buildSnapshot(config, rows));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="space-y-4">
      {/* Tracker switcher */}
      <nav
        aria-label="Trackers"
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-thin"
      >
        {trackers.map((tracker) => (
          <button
            key={tracker.key}
            type="button"
            onClick={() => setActiveKey(tracker.key)}
            className={cn("shrink-0", tracker.key === activeKey ? "chip-active" : "chip")}
          >
            {tracker.tab}
          </button>
        ))}
      </nav>

      <section className="glass-card-padded">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold tracking-tight text-ink-900 dark:text-ink-100">
              {config.title}
            </h3>
            <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-ink-600 dark:text-ink-300">
              {config.subtitle}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copySnapshot}
              disabled={rows.length === 0}
              className="btn-secondary !px-3 !py-1.5 text-[12.5px]"
            >
              <ClipboardCopy size={14} />
              {copied ? "Copied" : "Copy snapshot"}
            </button>
            <button
              type="button"
              onClick={exportCsv}
              disabled={rows.length === 0}
              className="btn-secondary !px-3 !py-1.5 text-[12.5px]"
            >
              <Download size={14} />
              Export CSV
            </button>
            <button
              type="button"
              onClick={addRow}
              className="btn-primary !px-3 !py-1.5 text-[12.5px]"
            >
              <Plus size={14} />
              {config.addLabel}
            </button>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={ClipboardList}
              title="Nothing tracked yet"
              description={`Add your first entry to start the ${config.title}. Rows save automatically to your account.`}
              action={
                <button type="button" onClick={addRow} className="btn-primary">
                  <Plus size={15} />
                  {config.addLabel}
                </button>
              }
            />
          </div>
        ) : (
          <>
            <div className="-mx-1 mt-4 overflow-x-auto px-1 scrollbar-thin">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-accent-champagne/20">
                    {config.columns.map((col) => (
                      <th
                        key={col.key}
                        className="px-1.5 py-2.5"
                        style={{ minWidth: col.minWidth ?? "9rem" }}
                      >
                        <span className="label whitespace-nowrap">{col.label}</span>
                      </th>
                    ))}
                    <th className="w-9 px-1.5 py-2.5">
                      <span className="sr-only">Remove row</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr
                      key={index}
                      className="border-b border-ink-200/70 align-top last:border-b-0 dark:border-accent-champagne/10"
                    >
                      {config.columns.map((col) => (
                        <td key={col.key} className="px-1.5 py-1.5">
                          <TrackerCell
                            column={col}
                            value={row[col.key] ?? ""}
                            onChange={(value) => updateCell(index, col.key, value)}
                          />
                        </td>
                      ))}
                      <td className="px-1.5 py-1.5">
                        <button
                          type="button"
                          onClick={() => removeRow(index)}
                          aria-label={`Remove row ${index + 1}`}
                          className="grid h-9 w-7 place-items-center rounded-lg text-ink-400 transition hover:bg-ink-800/60 hover:text-status-err"
                        >
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11.5px] text-ink-500 dark:text-ink-400">{status}</p>
          </>
        )}
      </section>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Brain,
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
  Folder,
  FolderTree,
  Loader2,
  Search,
  ShieldCheck,
  Wrench,
} from "lucide-react";

import type {
  DriveConnectionStatus,
  DriveFile,
  DriveFolder,
  GeneratorKind,
} from "@/lib/loanbrain/types";
import { cn } from "@/lib/utils";

import { GeneratorPanel } from "./GeneratorPanel";
import { StageStatusPill } from "./statusPill";

const ALL_KINDS: GeneratorKind[] = [
  "loan_summary",
  "processor_handoff",
  "missing_items",
  "ashley_email",
  "condition_plan",
  "overlay_note",
  "pipeline_update",
];

// The data source the browser is actually reading from. Until the read-only
// Drive/DB path returns "db", everything on screen is safe SAMPLE data — the
// banner must say so honestly regardless of which env vars are present.
type DataSource = "db" | "sample" | "unknown";

type DetailTab = "files" | "generate" | "memory";

interface FolderButtonsProps {
  folders: DriveFolder[];
  onPick: (folder: DriveFolder) => void;
  active?: string;
}

function FolderButtons({ folders, onPick, active }: FolderButtonsProps) {
  return (
    <ul className="space-y-1.5">
      {folders.map((f) => (
        <li key={f.id}>
          <button
            type="button"
            onClick={() => onPick(f)}
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors",
              active === f.id
                ? "border-accent-champagne/40 bg-accent-gold/5 text-ink-900 dark:bg-ink-800/40 dark:text-ink-100"
                : "border-ink-200 bg-white/50 text-ink-700 hover:border-accent-champagne/30 dark:border-ink-800 dark:bg-ink-900/40 dark:text-ink-200"
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <Folder size={14} className="shrink-0 text-accent-gold/80" />
              <span className="truncate">{f.label}</span>
            </span>
            {f.description?.includes("·") ? (
              <StageStatusPill
                status={
                  f.description.includes("needs a human") ||
                  f.description.includes("needs first")
                    ? "blocked"
                    : f.description.includes("working") ||
                      f.description.includes("gathering")
                    ? "working"
                    : "seen"
                }
              />
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

// Honest connection banner: it reads the ACTUAL data source returned by the API
// (sample vs db), never raw env presence. A green "live" state is only shown
// when real DB-backed Drive records are being served.
function ConnectionBanner({
  source,
  status,
}: {
  source: DataSource;
  status: DriveConnectionStatus;
}) {
  const [setupOpen, setSetupOpen] = useState(false);
  const isLive = source === "db";
  const pending = status.checklist.filter((c) => !c.done);

  return (
    <div
      className={cn(
        "rounded-xl border text-xs backdrop-blur-sm",
        isLive
          ? "border-status-ok/30 bg-status-ok/10"
          : "border-status-warn/30 bg-status-warn/10"
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 px-4 py-2.5",
          isLive ? "text-status-ok" : "text-status-warn"
        )}
      >
        <span className="flex items-center gap-2">
          <ShieldCheck size={14} className="shrink-0" />
          {isLive
            ? "Live read-only Drive — serving real borrower records."
            : "Sample mode — showing safe demo data. No real borrower files are connected."}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="chip">Read-only</span>
          {!isLive && (
            <button
              type="button"
              onClick={() => setSetupOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full border border-status-warn/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-status-warn transition-colors hover:bg-status-warn/10"
            >
              <Wrench size={11} />
              Setup needed
              <ChevronDown
                size={11}
                className={cn("transition-transform", setupOpen && "rotate-180")}
              />
            </button>
          )}
        </span>
      </div>

      {!isLive && setupOpen && (
        <div className="border-t border-status-warn/20 px-4 py-3">
          <p className="text-[11px] text-ink-700 dark:text-ink-300">
            Google Drive OAuth is not live yet. Connect a read-only Workspace
            identity to browse real files. Until then everything below is sample
            data.
          </p>
          <ul className="mt-2 space-y-1">
            {status.checklist.map((c) => (
              <li
                key={c.label}
                className="flex items-start gap-1.5 text-[11px] text-ink-700 dark:text-ink-300"
              >
                <span
                  className={cn(
                    "mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                    c.done ? "bg-status-ok" : "bg-status-warn"
                  )}
                />
                <span className={c.done ? "" : "text-ink-600 dark:text-ink-400"}>
                  {c.label}
                </span>
              </li>
            ))}
          </ul>
          {pending.length > 0 && (
            <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-ink-500 dark:text-ink-500">
              {pending.length} step{pending.length === 1 ? "" : "s"} remaining ·
              identity: {status.identityNeeded}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Memory tab — clearly labelled placeholder. Connects to persistent loan memory
// when that capability is enabled by the owner. No fabricated memory data.
function MemoryTab({ borrowerLabel }: { borrowerLabel: string }) {
  return (
    <div className="card-padded">
      <div className="section-title">
        <div>
          <h2>Loan memory</h2>
          <p>Recall past notes, decisions, and context for this borrower.</p>
        </div>
        <span className="chip-off">Not enabled</span>
      </div>
      <div className="mt-3 rounded-xl border border-dashed border-ink-300 bg-white/40 p-5 text-center dark:border-ink-700 dark:bg-ink-900/40">
        <span className="mx-auto grid h-10 w-10 place-items-center rounded-full border border-accent-gold/30 bg-white/60 text-accent-gold dark:bg-ink-900/70">
          <Brain size={18} />
        </span>
        <p className="mt-2 text-sm font-semibold text-ink-900 dark:text-ink-100">
          Persistent loan memory is off
        </p>
        <p className="mx-auto mt-1 max-w-md text-xs text-ink-600 dark:text-ink-400">
          When the owner enables the loan-memory layer, this tab surfaces the
          retrieved history for{" "}
          <span className="font-medium text-ink-800 dark:text-ink-200">
            {borrowerLabel}
          </span>{" "}
          — prior summaries, conditions cleared, and decisions made — before any
          new draft is written. Nothing is stored or recalled until then.
        </p>
      </div>
    </div>
  );
}

export function LoanBrainBrowser({ status }: { status: DriveConnectionStatus }) {
  const [roots, setRoots] = useState<DriveFolder[]>([]);
  const [source, setSource] = useState<DataSource>("unknown");
  const [selectedRoot, setSelectedRoot] = useState<DriveFolder | null>(null);
  const [subfolders, setSubfolders] = useState<DriveFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<DriveFolder | null>(null);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<DriveFolder[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>("files");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/loanbrain/drive?view=roots");
        const data = await res.json();
        if (data.ok) {
          setRoots(data.roots as DriveFolder[]);
          // The API reports the true source it read from. Default to sample if
          // the field is ever missing — never assume "live".
          setSource((data.source as DataSource) ?? "sample");
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  const openRoot = useCallback(async (root: DriveFolder) => {
    setSelectedRoot(root);
    setSelectedFolder(null);
    setFiles([]);
    setPreviewFile(null);
    setSearchResults(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/loanbrain/drive?view=folder&id=${encodeURIComponent(root.id)}`
      );
      const data = await res.json();
      if (data.ok) setSubfolders((data.subfolders as DriveFolder[]) ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  const openBorrowerFolder = useCallback(async (folder: DriveFolder) => {
    setSelectedFolder(folder);
    setPreviewFile(null);
    setDetailTab("files");
    setLoading(true);
    try {
      const res = await fetch(
        `/api/loanbrain/drive?view=folder&id=${encodeURIComponent(folder.id)}`
      );
      const data = await res.json();
      if (data.ok) setFiles((data.files as DriveFile[]) ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  async function runSearch(q: string) {
    setSearch(q);
    if (!q.trim()) {
      setSearchResults(null);
      return;
    }
    try {
      const res = await fetch(
        `/api/loanbrain/drive?view=search&q=${encodeURIComponent(q)}`
      );
      const data = await res.json();
      if (data.ok) setSearchResults(data.folders as DriveFolder[]);
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-4">
      <ConnectionBanner source={source} status={status} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-3">
          <div className="card-padded">
            <label className="field-label">Search borrowers</label>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-ink-200 bg-white/60 px-2.5 dark:border-ink-700/80 dark:bg-ink-950/50">
              <Search size={14} className="text-ink-500 dark:text-ink-400" />
              <input
                value={search}
                onChange={(e) => runSearch(e.target.value)}
                placeholder="Name or loan #"
                className="w-full bg-transparent py-2 text-sm text-ink-900 outline-none placeholder:text-ink-500 dark:text-ink-100 dark:placeholder:text-ink-500"
              />
            </div>
          </div>

          {searchResults ? (
            <div className="card-padded">
              <p className="label mb-2">Search results</p>
              <FolderButtons
                folders={searchResults}
                onPick={openBorrowerFolder}
                active={selectedFolder?.id}
              />
            </div>
          ) : (
            <div className="card-padded">
              <p className="label mb-2">Pipeline</p>
              <ul className="space-y-0.5">
                {roots.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => openRoot(r)}
                      className={cn(
                        "group flex w-full items-center justify-between rounded-xl border border-transparent px-3 py-2 text-sm transition-colors hover:bg-accent-gold/5 dark:hover:bg-ink-800/30",
                        selectedRoot?.id === r.id
                          ? "border-accent-champagne/30 bg-accent-gold/5 text-ink-900 dark:bg-ink-800/30 dark:text-ink-100"
                          : "text-ink-700 dark:text-ink-300"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <FolderTree size={15} className="text-accent-gold/80" />
                        {r.label}
                      </span>
                      <ChevronRight size={13} className="opacity-50" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {!selectedRoot && !selectedFolder && (
            <div className="card flex flex-col items-center justify-center gap-3 p-10 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-full border border-accent-gold/30 bg-white/60 text-accent-gold dark:bg-ink-900/70">
                <FolderTree size={20} />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">
                  Pick a pipeline section
                </p>
                <p className="mt-1 text-xs text-ink-600 dark:text-ink-300">
                  Choose ACTIVE LOANS, LEADS, PROSPECTS, PAST CLIENTS, or a reference
                  folder to begin.
                </p>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-ink-600 dark:text-ink-300">
              <Loader2 size={14} className="animate-spin" /> Loading&hellip;
            </div>
          )}

          {selectedRoot && !selectedFolder && !loading && (
            <div className="card-padded">
              <div className="section-title">
                <div>
                  <h2>{selectedRoot.label}</h2>
                  <p>{selectedRoot.description ?? "Borrower folders"}</p>
                </div>
              </div>
              <div className="mt-3">
                {subfolders.length === 0 ? (
                  <p className="text-xs text-ink-600 dark:text-ink-400">
                    No borrower folders in this section yet.
                  </p>
                ) : (
                  <FolderButtons folders={subfolders} onPick={openBorrowerFolder} />
                )}
              </div>
            </div>
          )}

          {selectedFolder && (
            <>
              <div className="flex items-center gap-2 text-xs text-ink-600 dark:text-ink-400">
                {selectedRoot && (
                  <button
                    onClick={() => setSelectedFolder(null)}
                    className="hover:text-ink-900 dark:hover:text-ink-200"
                  >
                    {selectedRoot.label}
                  </button>
                )}
                <ChevronRight size={12} />
                <span className="text-ink-800 dark:text-ink-200">
                  {selectedFolder.label}
                </span>
              </div>

              {/* Compact tabs keep Files / Generate / Memory in one panel rather
                  than stacking three tall cards. */}
              <div className="flex items-center gap-1 rounded-xl border border-ink-200 bg-white/50 p-1 dark:border-ink-800 dark:bg-ink-900/40">
                {(
                  [
                    { id: "files", label: "Files", icon: FileText },
                    { id: "generate", label: "Generate", icon: FileText },
                    { id: "memory", label: "Memory", icon: Brain },
                  ] as { id: DetailTab; label: string; icon: typeof FileText }[]
                ).map((t) => {
                  const Icon = t.icon;
                  const active = detailTab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setDetailTab(t.id)}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                        active
                          ? "bg-accent-gold/10 text-ink-900 shadow-sm dark:bg-ink-800/60 dark:text-ink-100"
                          : "text-ink-600 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-200"
                      )}
                    >
                      <Icon size={13} className={active ? "text-accent-gold" : ""} />
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {detailTab === "files" && (
                <div className="card-padded">
                  <div className="section-title">
                    <div>
                      <h2>Files</h2>
                      <p>
                        Read-only.{" "}
                        {source === "db"
                          ? "Live Drive files."
                          : "Sample listing — preview is a placeholder until live Drive is connected."}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                    {files.length === 0 ? (
                      <p className="text-xs text-ink-600 dark:text-ink-400">
                        No files listed for this folder.
                      </p>
                    ) : (
                      files.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setPreviewFile(f)}
                          className={cn(
                            "flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-colors",
                            previewFile?.id === f.id
                              ? "border-accent-champagne/40 bg-accent-gold/5 dark:bg-ink-800/40"
                              : "border-ink-200 bg-white/50 hover:border-accent-champagne/30 dark:border-ink-800 dark:bg-ink-900/40"
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <FileText
                              size={13}
                              className="shrink-0 text-ink-500 dark:text-ink-400"
                            />
                            <span className="truncate text-ink-800 dark:text-ink-200">
                              {f.name}
                            </span>
                          </span>
                          <span
                            className={
                              f.status === "received" ? "chip-ok" : "chip-warn"
                            }
                          >
                            {f.status}
                          </span>
                        </button>
                      ))
                    )}
                  </div>

                  {previewFile && (
                    <div className="mt-3 rounded-xl border border-ink-200 bg-white/50 p-4 dark:border-ink-800 dark:bg-ink-950/60">
                      <p className="flex items-center gap-2 text-xs font-medium text-ink-800 dark:text-ink-200">
                        <Eye size={13} className="text-accent-gold" /> {previewFile.name}
                      </p>
                      <div className="mt-2 grid h-40 place-items-center rounded-lg border border-dashed border-ink-300 bg-white/40 text-center dark:border-ink-700 dark:bg-ink-900/40">
                        <div>
                          <FileText
                            size={22}
                            className="mx-auto text-ink-400 dark:text-ink-500"
                          />
                          <p className="mt-2 text-[11px] text-ink-600 dark:text-ink-400">
                            Inline preview placeholder
                          </p>
                          <p className="text-[10px] text-ink-500 dark:text-ink-500">
                            Renders the real file once read-only Drive is connected.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {detailTab === "generate" && (
                <GeneratorPanel
                  folderId={selectedFolder.id}
                  allowedKinds={ALL_KINDS}
                />
              )}

              {detailTab === "memory" && (
                <MemoryTab borrowerLabel={selectedFolder.label} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

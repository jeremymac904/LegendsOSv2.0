"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Brain,
  ChevronRight,
  Eye,
  FileText,
  Folder,
  FolderTree,
  Loader2,
  Search,
  ShieldCheck,
} from "lucide-react";

import type {
  DriveConnectionStatus,
  DriveFile,
  DriveFolder,
  GeneratorKind,
} from "@/lib/loanbrain/types";
import { cn } from "@/lib/utils";

import { GeneratorPanel } from "./GeneratorPanel";
import { LoanMemoryTab, type LoanMemoryTabBundle } from "./LoanMemoryTab";
import { buildSampleLoanMemoryBundle } from "./sampleLoanMemory";
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

interface FolderButtonsProps {
  folders: DriveFolder[];
  onPick: (folder: DriveFolder) => void;
  active?: string;
}

function FolderButtons({ folders, onPick, active }: FolderButtonsProps) {
  return (
    <ul className="space-y-1">
      {folders.map((f) => (
        <li key={f.id}>
          <button
            type="button"
            onClick={() => onPick(f)}
            aria-pressed={active === f.id}
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-sm transition-colors",
              active === f.id
                ? "border-accent-champagne/40 bg-accent-champagne/10 text-ink-900 dark:bg-ink-800/40 dark:text-ink-100"
                : "border-ink-200 bg-white/60 text-ink-700 hover:border-accent-champagne/30 dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-200"
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

export function LoanBrainBrowser({ status }: { status: DriveConnectionStatus }) {
  const [roots, setRoots] = useState<DriveFolder[]>([]);
  const [selectedRoot, setSelectedRoot] = useState<DriveFolder | null>(null);
  const [subfolders, setSubfolders] = useState<DriveFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<DriveFolder | null>(null);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<DriveFolder[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<"files" | "memory">("files");
  // Phase 1: no live memory wiring yet — feed the Memory tab a clearly-labeled
  // SAMPLE bundle keyed to the selected borrower folder so it is demoable
  // without real data. Swapped for a real bundle once memory is connected.
  const memoryBundle: LoanMemoryTabBundle = useMemo(
    () => buildSampleLoanMemoryBundle(selectedFolder?.label),
    [selectedFolder?.label]
  );

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/loanbrain/drive?view=roots");
        const data = await res.json();
        if (data.ok) setRoots(data.roots as DriveFolder[]);
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
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-xs backdrop-blur-sm",
          status.connected
            ? "border-status-ok/30 bg-status-ok/10 text-status-ok"
            : "border-status-warn/30 bg-status-warn/10 text-status-warn"
        )}
      >
        <span className="flex items-center gap-2">
          <ShieldCheck size={14} />
          {status.connected
            ? "Read-only Drive connection active — showing live borrower data."
            : "Sample Mode — demo borrower data, no live Drive connection. Nothing here is a real borrower."}
        </span>
        <span className="chip">Read-only</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-3">
          <div className="card-padded">
            <label className="field-label">Search borrowers</label>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-ink-200 bg-white/70 px-2.5 dark:border-ink-700/80 dark:bg-ink-950/50">
              <Search size={14} className="text-ink-500 dark:text-ink-400" />
              <input
                value={search}
                onChange={(e) => runSearch(e.target.value)}
                placeholder="Name or loan #"
                className="w-full bg-transparent py-2 text-sm text-ink-900 outline-none placeholder:text-ink-500 dark:text-ink-100"
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
                      aria-pressed={selectedRoot?.id === r.id}
                      className={cn(
                        "group flex w-full items-center justify-between rounded-lg border border-transparent px-2.5 py-1.5 text-sm transition-colors hover:bg-ink-100/60 dark:hover:bg-ink-800/30",
                        selectedRoot?.id === r.id
                          ? "border-accent-champagne/30 bg-accent-champagne/10 text-ink-900 dark:bg-ink-800/30 dark:text-ink-100"
                          : "text-ink-600 dark:text-ink-300"
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
              <span className="grid h-12 w-12 place-items-center rounded-full border border-accent-gold/30 bg-white/70 text-accent-gold dark:bg-ink-900/70">
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
                  <p className="text-xs text-ink-500 dark:text-ink-400">
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
              <div className="flex items-center gap-2 text-xs text-ink-500 dark:text-ink-400">
                {selectedRoot && (
                  <button
                    onClick={() => setSelectedFolder(null)}
                    className="hover:text-ink-700 dark:hover:text-ink-200"
                  >
                    {selectedRoot.label}
                  </button>
                )}
                <ChevronRight size={12} />
                <span className="text-ink-700 dark:text-ink-200">{selectedFolder.label}</span>
              </div>

              {/* Detail tabs: Files (Drive) + Memory (loan memory file) */}
              <div className="flex items-center gap-1 rounded-xl border border-ink-200 bg-white/60 p-1 dark:border-ink-800 dark:bg-ink-950/40">
                {([
                  { id: "files", label: "Files", icon: FileText },
                  { id: "memory", label: "Memory", icon: Brain },
                ] as const).map((t) => {
                  const Icon = t.icon;
                  const active = detailTab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setDetailTab(t.id)}
                      aria-pressed={active}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors",
                        active
                          ? "bg-accent-champagne/10 text-ink-900 dark:bg-ink-800/40 dark:text-ink-100"
                          : "text-ink-600 hover:text-ink-900 dark:text-ink-300 dark:hover:text-ink-100"
                      )}
                    >
                      <Icon size={13} className={active ? "text-accent-gold" : "text-ink-500 dark:text-ink-400"} />
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {detailTab === "memory" ? (
                <div className="card-padded">
                  <div className="section-title">
                    <div>
                      <h2>Loan memory</h2>
                      <p>
                        What the assistant knows about this loan — snapshot, timeline,
                        documents, blockers, and AI notes.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <LoanMemoryTab bundle={memoryBundle} />
                  </div>
                </div>
              ) : (
                <>
              <div className="card-padded">
                <div className="section-title">
                  <div>
                    <h2>Files</h2>
                    <p>
                      Read-only. Preview is a placeholder until live Drive is
                      connected.
                    </p>
                  </div>
                </div>
                {/* Split: compact file list on the left, preview detail on the right */}
                <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1.4fr]">
                  <ul className="space-y-1">
                    {files.length === 0 ? (
                      <li className="text-xs text-ink-500 dark:text-ink-400">
                        No files listed for this folder.
                      </li>
                    ) : (
                      files.map((f) => (
                        <li key={f.id}>
                          <button
                            type="button"
                            onClick={() => setPreviewFile(f)}
                            aria-pressed={previewFile?.id === f.id}
                            className={cn(
                              "flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors",
                              previewFile?.id === f.id
                                ? "border-accent-champagne/40 bg-accent-champagne/10 dark:bg-ink-800/40"
                                : "border-ink-200 bg-white/60 hover:border-accent-champagne/30 dark:border-ink-800 dark:bg-ink-950/40"
                            )}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <FileText size={13} className="shrink-0 text-ink-500 dark:text-ink-400" />
                              <span className="truncate text-ink-700 dark:text-ink-200">{f.name}</span>
                            </span>
                            <span
                              className={
                                f.status === "received" ? "chip-ok" : "chip-warn"
                              }
                            >
                              {f.status}
                            </span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>

                  {previewFile ? (
                    <div className="rounded-xl border border-ink-200 bg-white/70 p-4 dark:border-ink-800 dark:bg-ink-950/60">
                      <p className="flex items-center gap-2 text-xs font-medium text-ink-700 dark:text-ink-200">
                        <Eye size={13} className="text-accent-gold" /> {previewFile.name}
                      </p>
                      <div className="mt-2 grid h-40 place-items-center rounded-lg border border-dashed border-ink-300 bg-ink-50/60 text-center dark:border-ink-700 dark:bg-ink-900/40">
                        <div>
                          <FileText size={22} className="mx-auto text-ink-400 dark:text-ink-500" />
                          <p className="mt-2 text-[11px] text-ink-500 dark:text-ink-400">
                            Inline preview placeholder
                          </p>
                          <p className="text-[10px] text-ink-400 dark:text-ink-500">
                            Renders the real file once read-only Drive is connected.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid place-items-center rounded-xl border border-dashed border-ink-200 p-4 text-center text-[11px] text-ink-500 dark:border-ink-800 dark:text-ink-400">
                      Select a file to preview it here.
                    </div>
                  )}
                </div>
              </div>

              <GeneratorPanel folderId={selectedFolder.id} allowedKinds={ALL_KINDS} />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

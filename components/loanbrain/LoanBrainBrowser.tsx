"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Brain,
  Briefcase,
  CheckCircle2,
  Clock,
  FileSearch,
  Filter,
  Loader2,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";

import type { DriveConnectionStatus } from "@/lib/loanbrain/types";
import { cn } from "@/lib/utils";

import { LoanMemoryTab, type LoanMemoryTabBundle } from "./LoanMemoryTab";
import { buildSampleLoanMemoryBundle } from "./sampleLoanMemory";

type FilterKey = "all" | "active" | "leads" | "prospects" | "past_clients";

interface MemoryListItem {
  id: string;
  loan_id: string | null;
  borrower_name: string | null;
  co_borrower_name: string | null;
  loan_number: string | null;
  property_address: string | null;
  current_stage: string | null;
  main_blocker: string | null;
  next_action: string | null;
  primary_loan_officer: string | null;
  processor: string | null;
  loan_coordinator: string | null;
  confidence: "high" | "medium" | "low";
  priority: string;
  updated_at: string;
  last_known_activity: string | null;
  category: FilterKey;
  is_sample: boolean;
}

interface SearchState {
  source: string;
  memories: MemoryListItem[];
  setup_missing: string[];
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active loans" },
  { key: "leads", label: "Leads" },
  { key: "prospects", label: "Prospects" },
  { key: "past_clients", label: "Past clients" },
];

function fmtWhen(value: string | null | undefined): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function val(value: string | null | undefined, fallback = "Unknown"): string {
  const v = value?.trim();
  return v ? v : fallback;
}

function assistantPrompt(kind: "atlas" | "flo" | "coordinator", memory: MemoryListItem): string {
  const who = val(memory.borrower_name, "this borrower");
  const loan = memory.loan_number ? ` loan #${memory.loan_number}` : "";
  if (kind === "flo") {
    return `Use Loan Brain context for ${who}${loan}. Build a condition plan, missing-document list, processing notes, borrower follow-up, and CTC prep.`;
  }
  if (kind === "coordinator") {
    return `Use Loan Brain context for ${who}${loan}. Build the follow-up queue, missing items, borrower update, Realtor update, and title follow-up.`;
  }
  return `Use Loan Brain context for ${who}${loan}. Summarize status, blocker, next action, assigned team, and source confidence.`;
}

function atlasLoanPrompt(kind: "borrower" | "file" | "condition", memory: MemoryListItem): string {
  const who = val(memory.borrower_name, "this borrower");
  const loan = memory.loan_number ? ` loan #${memory.loan_number}` : "";
  if (kind === "file") {
    return `Ask Atlas about the loan file for ${who}${loan}. Load Loan Brain memory, loan events, documents, tasks, browser context, and knowledge sources before responding. Tell me what is complete, what is missing, and what should happen next.`;
  }
  if (kind === "condition") {
    return `Ask Atlas about conditions for ${who}${loan}. Load Loan Brain memory before answering. Identify known conditions, likely missing documents, and a processor-ready response plan. If no condition data is loaded, say exactly what identifier or source is missing.`;
  }
  return `Ask Atlas about borrower ${who}${loan}. Load Loan Brain memory before answering. Summarize borrower status, current stage, blocker, next action, assigned team, and what context is missing.`;
}

function SetupPanel({
  connected,
  setupMissing,
}: {
  connected: boolean;
  setupMissing: string[];
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        connected
          ? "border-status-ok/30 bg-status-ok/10"
          : "border-status-warn/30 bg-status-warn/10"
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/70 dark:bg-ink-950/40">
          {connected ? <ShieldCheck size={16} className="text-status-ok" /> : <AlertTriangle size={16} className="text-status-warn" />}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">
            {connected ? "Live memory available" : "Live Loan Brain setup incomplete"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-600 dark:text-ink-300">
            This page never labels sample data as live. When real memory is missing, the exact blockers stay visible here.
          </p>
          {setupMissing.length > 0 && (
            <ul className="mt-2 space-y-1">
              {setupMissing.slice(0, 5).map((item, index) => (
                <li key={`${item}-${index}`} className="flex gap-2 text-[11px] leading-snug text-ink-700 dark:text-ink-300">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-status-warn" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Snapshot({ memory, bundle }: { memory: MemoryListItem; bundle: LoanMemoryTabBundle | null }) {
  const docs = bundle?.documents.length ?? 0;
  const conditions = bundle?.conditions?.length ?? 0;
  const tasks = bundle?.open_tasks.length ?? 0;
  const events = bundle?.events.length ?? 0;
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
      {[
        { label: "Documents", value: String(docs), icon: FileSearch },
        { label: "Conditions", value: String(conditions), icon: CheckCircle2 },
        { label: "Tasks", value: String(tasks), icon: Briefcase },
        { label: "Timeline", value: String(events), icon: Clock },
      ].map((item) => (
        <div key={item.label} className="rounded-xl border border-ink-200 bg-white/60 p-3 dark:border-ink-800 dark:bg-ink-950/40">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500">{item.label}</p>
            <item.icon size={14} className="text-accent-gold" />
          </div>
          <p className="mt-1 text-xl font-semibold text-ink-900 dark:text-ink-100">{item.value}</p>
        </div>
      ))}
      <div className="rounded-xl border border-accent-gold/25 bg-accent-gold/[0.06] p-3 lg:col-span-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent-gold">Next action</p>
            <p className="mt-1 text-xs font-medium text-ink-900 dark:text-ink-100">{val(memory.next_action)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-status-warn">Open blocker</p>
            <p className="mt-1 text-xs font-medium text-ink-900 dark:text-ink-100">{val(memory.main_blocker, "No blocker recorded")}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500">Confidence</p>
            <p className="mt-1 inline-flex items-center gap-1 rounded-full border border-ink-200 bg-white/70 px-2 py-1 text-xs font-medium capitalize dark:border-ink-700 dark:bg-ink-900/60">
              <Sparkles size={12} className="text-accent-gold" />
              {memory.confidence}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LoanBrainBrowser({ status }: { status: DriveConnectionStatus }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [searchState, setSearchState] = useState<SearchState>({
    source: "loading",
    memories: [],
    setup_missing: [],
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bundle, setBundle] = useState<LoanMemoryTabBundle | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingBundle, setLoadingBundle] = useState(false);
  const [showSample, setShowSample] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoadingList(true);
      try {
        const params = new URLSearchParams({ q: query, filter });
        const res = await fetch(`/api/loan-memory/search?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error ?? "search_failed");
        const memories = (data.memories ?? []) as MemoryListItem[];
        setSearchState({
          source: data.source ?? "empty",
          memories,
          setup_missing: (data.setup_missing ?? []) as string[],
        });
        setSelectedId((current) => {
          if (current && memories.some((memory) => memory.id === current)) return current;
          return memories[0]?.id ?? null;
        });
      } catch (error) {
        if (!controller.signal.aborted) {
          setSearchState({
            source: "error",
            memories: [],
            setup_missing: ["Loan Memory search API is unavailable."],
          });
          setSelectedId(null);
        }
      } finally {
        if (!controller.signal.aborted) setLoadingList(false);
      }
    }, 200);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, filter]);

  const selected = useMemo(
    () => searchState.memories.find((memory) => memory.id === selectedId) ?? null,
    [searchState.memories, selectedId]
  );

  useEffect(() => {
    if (!selected?.id) {
      setBundle(null);
      return;
    }
    const controller = new AbortController();
    (async () => {
      setLoadingBundle(true);
      try {
        const res = await fetch("/api/loan-memory/context", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            loan_memory_id: selected.id,
            query_text: [selected.borrower_name, selected.loan_number, selected.property_address].filter(Boolean).join(" "),
          }),
          signal: controller.signal,
        });
        const data = await res.json();
        if (data.ok && data.bundle?.memory) {
          setBundle(data.bundle as LoanMemoryTabBundle);
        } else {
          setBundle(null);
        }
      } catch {
        if (!controller.signal.aborted) setBundle(null);
      } finally {
        if (!controller.signal.aborted) setLoadingBundle(false);
      }
    })();
    return () => controller.abort();
  }, [selected]);

  const setupMissing = searchState.setup_missing.length ? searchState.setup_missing : [status.reason];
  const hasLiveMemories = searchState.memories.some((memory) => !memory.is_sample);
  const sampleBundle = useMemo(() => buildSampleLoanMemoryBundle("Sample borrower"), []);

  return (
    <div className="space-y-4">
      <SetupPanel connected={hasLiveMemories} setupMissing={setupMissing} />

      <div className="grid min-h-[660px] grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        <aside className="flex flex-col gap-3 rounded-2xl border border-ink-200 bg-white/50 p-3 dark:border-ink-800 dark:bg-ink-950/30">
          <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-white/70 px-3 py-2 dark:border-ink-800 dark:bg-ink-950/50">
            <Search size={14} className="text-ink-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Borrower, co-borrower, address, loan #..."
              className="w-full bg-transparent text-xs text-ink-900 outline-none placeholder:text-ink-500 dark:text-ink-100"
            />
          </div>

          <div className="flex flex-wrap gap-1">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium transition-colors",
                  filter === item.key
                    ? "border-accent-gold/50 bg-accent-gold/15 text-ink-900 dark:text-ink-100"
                    : "border-ink-200 bg-white/60 text-ink-600 hover:border-accent-gold/30 dark:border-ink-800 dark:bg-ink-900/50 dark:text-ink-300"
                )}
              >
                <Filter size={10} />
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between px-1 text-[10px] uppercase tracking-[0.16em] text-ink-500">
            <span>{searchState.source === "loan_memory" ? "Live memory" : "Memory list"}</span>
            {loadingList && <Loader2 size={12} className="animate-spin" />}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-thin">
            {searchState.memories.length === 0 ? (
              <div className="rounded-xl border border-dashed border-ink-200 p-4 text-center dark:border-ink-800">
                <Brain size={18} className="mx-auto text-ink-400" />
                <p className="mt-2 text-xs font-medium text-ink-900 dark:text-ink-100">No live loan memory visible</p>
                <p className="mt-1 text-[11px] text-ink-500">Apply migrations, enable memory, or assign loans to this user.</p>
                <button type="button" onClick={() => setShowSample((v) => !v)} className="btn-secondary mt-3 text-xs">
                  {showSample ? "Hide sample fallback" : "Show sample fallback"}
                </button>
              </div>
            ) : (
              <ul className="space-y-1">
                {searchState.memories.map((memory) => (
                  <li key={memory.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(memory.id)}
                      aria-pressed={selectedId === memory.id}
                      className={cn(
                        "w-full rounded-xl border px-3 py-2 text-left transition-colors",
                        selectedId === memory.id
                          ? "border-accent-gold/45 bg-accent-gold/10"
                          : "border-ink-200 bg-white/60 hover:border-accent-gold/30 dark:border-ink-800 dark:bg-ink-950/40"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <UserRound size={14} className="mt-0.5 shrink-0 text-accent-gold" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-ink-900 dark:text-ink-100">{val(memory.borrower_name, "Unnamed borrower")}</p>
                          <p className="truncate text-[10.5px] text-ink-500">
                            {[memory.loan_number && `#${memory.loan_number}`, memory.current_stage, memory.property_address].filter(Boolean).join(" · ") || "No identifiers recorded"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[9.5px]">
                        <span className="chip capitalize">{memory.category.replace("_", " ")}</span>
                        <span className="chip capitalize">{memory.confidence}</span>
                        {memory.main_blocker && <span className="chip-warn">blocked</span>}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <section className="min-w-0 rounded-2xl border border-ink-200 bg-white/45 dark:border-ink-800 dark:bg-ink-950/25">
          {!selected ? (
            <div className="grid h-full min-h-[520px] place-items-center p-8 text-center">
              {showSample ? (
                <div className="w-full max-w-4xl text-left">
                  <div className="mb-3 rounded-xl border border-status-warn/30 bg-status-warn/10 px-3 py-2 text-xs text-status-warn">
                    Sample fallback only. This is fictional data and is not connected to Drive, Gmail, or the portal.
                  </div>
                  <LoanMemoryTab bundle={sampleBundle} />
                </div>
              ) : (
                <div>
                  <Brain size={24} className="mx-auto text-ink-400" />
                  <p className="mt-2 text-sm font-semibold text-ink-900 dark:text-ink-100">No borrower selected</p>
                  <p className="mt-1 text-xs text-ink-500">Search live memory or open the sample fallback to preview the cockpit shape.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full min-h-[660px] flex-col">
              <div className="border-b border-ink-200 px-4 py-3 dark:border-ink-800">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-gold">Borrower snapshot</p>
                    <h2 className="mt-1 truncate text-lg font-semibold text-ink-900 dark:text-ink-100">
                      {val(selected.borrower_name, "Unnamed borrower")}
                      {selected.co_borrower_name && <span className="text-ink-500"> &amp; {selected.co_borrower_name}</span>}
                    </h2>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {[selected.loan_number && `Loan #${selected.loan_number}`, selected.property_address, selected.current_stage].filter(Boolean).join(" · ") || "Identifiers missing"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(["borrower", "file", "condition"] as const).map((kind) => (
                      <Link
                        key={kind}
                        href={`/atlas?prompt=${encodeURIComponent(atlasLoanPrompt(kind, selected))}`}
                        className="btn-secondary text-xs"
                      >
                        <MessageCircle size={13} />
                        Ask Atlas about {kind}
                      </Link>
                    ))}
                    {(["atlas", "flo", "coordinator"] as const).map((kind) => (
                      <Link
                        key={kind}
                        href={`/atlas?prompt=${encodeURIComponent(assistantPrompt(kind, selected))}`}
                        className={kind === "atlas" ? "btn-primary text-xs" : "btn-secondary text-xs"}
                      >
                        <MessageCircle size={13} />
                        {kind === "atlas" ? "Ask Atlas" : kind === "flo" ? "Ask FLO" : "Ask Coordinator"}
                      </Link>
                    ))}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 text-[11px] text-ink-600 dark:text-ink-300 sm:grid-cols-3">
                  <span className="flex items-center gap-1.5"><Users size={12} /> LO: {val(selected.primary_loan_officer)}</span>
                  <span>Processor: {val(selected.processor)}</span>
                  <span>Coordinator: {val(selected.loan_coordinator)}</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
                <Snapshot memory={selected} bundle={bundle} />
                <div className="mt-4">
                  {loadingBundle ? (
                    <div className="grid h-48 place-items-center rounded-xl border border-ink-200 dark:border-ink-800">
                      <Loader2 size={20} className="animate-spin text-accent-gold" />
                    </div>
                  ) : bundle ? (
                    <LoanMemoryTab bundle={bundle} />
                  ) : (
                    <div className="rounded-xl border border-status-warn/30 bg-status-warn/10 p-4 text-sm text-status-warn">
                      Loan memory matched, but the bundle could not be loaded. Check RLS access and applied migrations.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

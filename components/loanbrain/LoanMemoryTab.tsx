"use client";

// LegendsOS v2 — Loan Memory tab.
// Renders a single loan's "memory file": the current snapshot, the event
// timeline, documents, blockers, next actions, AI notes, and source links.
// Props take a LoanMemoryBundle-shaped object (memory, events, documents,
// open_tasks, email_intake, drive_links, retrieval_summary, sources_checked).
// When no real loan is connected (or the migration is unapplied), the bundle's
// memory.is_sample flag drives a clear SAMPLE MODE banner. Never crashes on
// missing data — every section degrades to an honest empty/unknown state.

import {
  AlertTriangle,
  Brain,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  FlaskConical,
  Link2,
  ListChecks,
  Mail,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import type {
  LoanMemory,
  LoanMemoryEvent,
  MemoryConfidence,
} from "@/lib/loanMemory/types";
import { cn } from "@/lib/utils";

// Mirror of LoanMemoryBundle (kept loose so the tab also accepts a
// SAMPLE bundle assembled client-side without importing server-only code).
export interface LoanMemoryTabBundle {
  memory: LoanMemory | null;
  events: LoanMemoryEvent[];
  open_tasks: Record<string, unknown>[];
  documents: Record<string, unknown>[];
  email_intake: Record<string, unknown>[];
  drive_links: Record<string, unknown>[];
  retrieval_summary: string;
  sources_checked: string[];
}

const CONFIDENCE_TONE: Record<MemoryConfidence, string> = {
  high: "chip-ok",
  medium: "chip-warn",
  low: "chip-err",
};

function val(v: unknown): string {
  if (v === null || v === undefined) return "Unknown";
  const s = String(v).trim();
  return s.length ? s : "Unknown";
}

function fmtDate(v: unknown): string {
  if (!v) return "Unknown";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtDay(v: unknown): string {
  if (!v) return "Unknown";
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function pick(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v !== null && v !== undefined && String(v).trim().length) return String(v);
  }
  return "";
}

// ─── Sub-blocks ───────────────────────────────────────────────────────────────

function FieldRow({ label, value, tone }: { label: string; value: string; tone?: "blocker" | "next" }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <span className="shrink-0 text-[11px] uppercase tracking-[0.14em] text-ink-500 dark:text-ink-400">{label}</span>
      <span
        className={cn(
          "min-w-0 text-right text-[12.5px] font-medium",
          tone === "blocker"
            ? "text-status-warn"
            : tone === "next"
            ? "text-accent-gold"
            : "text-ink-900 dark:text-ink-100",
          value === "Unknown" && "font-normal text-ink-500 dark:text-ink-400"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white/70 p-3.5 dark:border-ink-800 dark:bg-ink-950/40">
      <div className="mb-2.5 flex items-center gap-2">
        <Icon size={14} className="text-accent-gold" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-700 dark:text-ink-200">{title}</p>
        {typeof count === "number" && (
          <span className="ml-auto rounded-full border border-ink-200 bg-white/60 px-1.5 py-px text-[10px] text-ink-600 dark:border-ink-700 dark:bg-ink-900/60 dark:text-ink-300">
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return <p className="text-[11.5px] text-ink-500 dark:text-ink-400">{children}</p>;
}

const EVENT_DOT: Record<string, string> = {
  ai_note: "bg-accent-gold",
  document_received: "bg-status-ok",
  approval_update: "bg-status-info",
  condition_update: "bg-status-warn",
  closing_update: "bg-status-info",
};

function eventIsAiNote(e: LoanMemoryEvent): boolean {
  return e.event_type === "ai_note";
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LoanMemoryTab({ bundle }: { bundle: LoanMemoryTabBundle }) {
  const m = bundle.memory;
  const isSample = !m || m.is_sample === true;

  if (!m) {
    return (
      <div className="space-y-3">
        <SampleBanner reason="no-loan" />
        <div className="rounded-xl border border-dashed border-ink-200 p-6 text-center dark:border-ink-800">
          <Brain size={20} className="mx-auto text-ink-400 dark:text-ink-500" />
          <p className="mt-2 text-[12.5px] font-medium text-ink-900 dark:text-ink-100">No loan memory connected</p>
          <p className="mt-1 text-[11.5px] text-ink-500 dark:text-ink-400">
            Once a borrower is matched, the assistant&apos;s working memory for that loan appears here.
          </p>
        </div>
      </div>
    );
  }

  const blockers: { title: string; detail: string }[] = [];
  if (m.main_blocker && m.main_blocker.trim()) {
    blockers.push({ title: m.main_blocker, detail: "Primary blocker on the memory file" });
  }
  for (const t of bundle.open_tasks) {
    const title = pick(t, ["title", "name", "task", "label"]);
    const status = pick(t, ["status", "state"]);
    if (title && (status === "blocked" || status === "stuck")) {
      blockers.push({ title, detail: "Open task flagged blocked" });
    }
  }

  const aiNotes = bundle.events.filter(eventIsAiNote);
  const timeline = bundle.events;

  return (
    <div className="space-y-3">
      {isSample && <SampleBanner reason="sample-flag" />}

      {/* 1. Current file snapshot */}
      <div className="rounded-xl border border-accent-gold/25 bg-accent-gold/[0.05] p-3.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-gold">Loan memory file</p>
            <p className="mt-0.5 truncate text-[15px] font-semibold text-ink-900 dark:text-ink-100">
              {val(m.borrower_name)}
              {m.co_borrower_name ? <span className="text-ink-500 dark:text-ink-400"> &amp; {m.co_borrower_name}</span> : null}
            </p>
            <p className="mt-0.5 text-[11.5px] text-ink-600 dark:text-ink-300">
              {m.loan_number ? `Loan #${m.loan_number}` : "Loan # unknown"}
              {m.lender ? ` · ${m.lender}` : ""}
              {m.loan_type ? ` · ${m.loan_type}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <span className={cn("chip", CONFIDENCE_TONE[m.confidence] ?? "chip")}>
              <Sparkles size={10} /> {m.confidence} confidence
            </span>
            <span className="chip">{val(m.priority)} priority</span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2">
          <FieldRow label="Stage" value={val(m.current_stage)} />
          <FieldRow label="Property" value={val(m.property_address)} />
          <FieldRow label="Approval" value={val(m.approval_status)} />
          <FieldRow label="Appraisal" value={val(m.appraisal_status)} />
          <FieldRow label="Title" value={val(m.title_status)} />
          <FieldRow label="Insurance" value={val(m.insurance_status)} />
          <FieldRow label="Loan purpose" value={val(m.loan_purpose)} />
          <FieldRow label="Closing date" value={fmtDay(m.closing_date)} />
          <FieldRow label="Blocker" value={val(m.main_blocker)} tone={m.main_blocker ? "blocker" : undefined} />
          <FieldRow label="Next action" value={val(m.next_action)} tone={m.next_action ? "next" : undefined} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-ink-200/70 pt-2.5 text-[11px] text-ink-500 dark:border-ink-800 dark:text-ink-400">
          <span className="flex items-center gap-1.5">
            <Clock size={11} /> Updated {fmtDate(m.updated_at)}
          </span>
          {m.last_known_activity && (
            <span className="flex items-center gap-1.5">
              <CalendarClock size={11} /> Last activity {fmtDate(m.last_known_activity)}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* 4. Open blockers */}
        <SectionCard icon={ShieldAlert} title="Open blockers" count={blockers.length}>
          {blockers.length === 0 ? (
            <EmptyLine>No active blockers recorded.</EmptyLine>
          ) : (
            <ul className="space-y-1.5">
              {blockers.map((b, i) => (
                <li key={`${b.title}-${i}`} className="flex items-start gap-2">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0 text-status-warn" />
                  <span className="min-w-0">
                    <span className="block text-[12px] font-medium text-ink-900 dark:text-ink-100">{b.title}</span>
                    <span className="block text-[10.5px] text-ink-500 dark:text-ink-400">{b.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* 5. Next actions */}
        <SectionCard icon={ListChecks} title="Next actions" count={bundle.open_tasks.length}>
          {!m.next_action && bundle.open_tasks.length === 0 ? (
            <EmptyLine>No next action or open task on file.</EmptyLine>
          ) : (
            <ul className="space-y-1.5">
              {m.next_action && (
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-accent-gold" />
                  <span className="text-[12px] font-medium text-ink-900 dark:text-ink-100">{m.next_action}</span>
                </li>
              )}
              {bundle.open_tasks.slice(0, 6).map((t, i) => {
                const title = pick(t, ["title", "name", "task", "label"]) || "Open task";
                const due = pick(t, ["due_date", "due", "due_at"]);
                return (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-ink-400 dark:text-ink-500" />
                    <span className="min-w-0">
                      <span className="block text-[12px] text-ink-800 dark:text-ink-200">{title}</span>
                      {due && <span className="block text-[10.5px] text-ink-500 dark:text-ink-400">Due {fmtDay(due)}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* 3. Documents received */}
      <SectionCard icon={FileText} title="Documents received" count={bundle.documents.length}>
        {bundle.documents.length === 0 ? (
          <EmptyLine>No documents linked to this loan memory yet.</EmptyLine>
        ) : (
          <ul className="divide-y divide-ink-100 dark:divide-ink-800/70">
            {bundle.documents.slice(0, 12).map((d, i) => {
              const name = pick(d, ["file_name", "name", "title", "document_name"]) || "Document";
              const category = pick(d, ["folder_category", "category"]);
              const review = pick(d, ["review_status", "status"]);
              const from = pick(d, ["received_from", "from"]);
              const when = pick(d, ["submitted_date", "received_at", "created_at"]);
              return (
                <li key={i} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <FileText size={12} className="shrink-0 text-ink-500 dark:text-ink-400" />
                    <span className="min-w-0">
                      <span className="block truncate text-[12px] text-ink-800 dark:text-ink-200">{name}</span>
                      <span className="block truncate text-[10.5px] text-ink-500 dark:text-ink-400">
                        {[category, from && `from ${from}`, when && fmtDay(when)].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </span>
                  </span>
                  {review && <span className="chip shrink-0">{review}</span>}
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      {/* 2. Timeline of loan_memory_events */}
      <SectionCard icon={Clock} title="Memory timeline" count={timeline.length}>
        {timeline.length === 0 ? (
          <EmptyLine>No memory events recorded yet.</EmptyLine>
        ) : (
          <ol className="relative space-y-3 border-l border-ink-200 pl-4 dark:border-ink-800">
            {timeline.slice(0, 14).map((e) => (
              <li key={e.id} className="relative">
                <span
                  aria-hidden
                  className={cn(
                    "absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-ink-950",
                    EVENT_DOT[e.event_type] ?? "bg-ink-400"
                  )}
                />
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-[12px] font-medium text-ink-900 dark:text-ink-100">
                    {e.event_title || e.event_type.replace(/_/g, " ")}
                  </span>
                  <span className="rounded-full border border-ink-200 px-1.5 py-px text-[9.5px] uppercase tracking-[0.12em] text-ink-500 dark:border-ink-700 dark:text-ink-400">
                    {e.event_type.replace(/_/g, " ")}
                  </span>
                  <span className="ml-auto text-[10.5px] text-ink-500 dark:text-ink-400">
                    {fmtDate(e.source_timestamp || e.created_at)}
                  </span>
                </div>
                {e.event_summary && (
                  <p className="mt-0.5 text-[11.5px] leading-snug text-ink-600 dark:text-ink-300">{e.event_summary}</p>
                )}
                {(e.source_name || e.source_type) && (
                  <p className="mt-0.5 flex items-center gap-1 text-[10.5px] text-ink-500 dark:text-ink-400">
                    <Link2 size={10} />
                    {e.source_url_or_path ? (
                      <a href={e.source_url_or_path} className="text-accent-gold hover:underline" target="_blank" rel="noreferrer">
                        {e.source_name || e.source_type}
                      </a>
                    ) : (
                      <span>{[e.source_type, e.source_name].filter(Boolean).join(" · ")}</span>
                    )}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </SectionCard>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* 6. AI notes */}
        <SectionCard icon={Brain} title="AI notes" count={aiNotes.length}>
          {aiNotes.length === 0 ? (
            <EmptyLine>The assistant has not written any notes for this loan yet.</EmptyLine>
          ) : (
            <ul className="space-y-2">
              {aiNotes.slice(0, 6).map((e) => (
                <li key={e.id} className="rounded-lg border border-accent-gold/20 bg-accent-gold/[0.04] px-2.5 py-2">
                  <p className="text-[12px] font-medium text-ink-900 dark:text-ink-100">{e.event_title || "AI note"}</p>
                  {e.event_summary && <p className="mt-0.5 text-[11.5px] leading-snug text-ink-600 dark:text-ink-300">{e.event_summary}</p>}
                  <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-ink-500 dark:text-ink-400">{fmtDate(e.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* 7. Source links (Drive + email intake) */}
        <SectionCard icon={Link2} title="Sources" count={bundle.drive_links.length + bundle.email_intake.length}>
          {bundle.drive_links.length === 0 && bundle.email_intake.length === 0 ? (
            <EmptyLine>No Drive folders or matched email threads linked yet.</EmptyLine>
          ) : (
            <ul className="space-y-1.5">
              {bundle.drive_links.slice(0, 5).map((d, i) => {
                const label = pick(d, ["label", "name", "folder_category", "title"]) || "Drive folder";
                const url = pick(d, ["url", "web_view_link", "link"]);
                return (
                  <li key={`drive-${i}`} className="flex items-center gap-2 text-[11.5px]">
                    <FileText size={12} className="shrink-0 text-accent-gold/80" />
                    {url ? (
                      <a href={url} target="_blank" rel="noreferrer" className="truncate text-accent-gold hover:underline">{label}</a>
                    ) : (
                      <span className="truncate text-ink-700 dark:text-ink-200">{label}</span>
                    )}
                    <span className="ml-auto shrink-0 text-[10px] uppercase tracking-[0.12em] text-ink-500 dark:text-ink-400">Drive</span>
                  </li>
                );
              })}
              {bundle.email_intake.slice(0, 5).map((e, i) => {
                const subject = pick(e, ["subject", "title"]) || "Email";
                const from = pick(e, ["from_address", "from"]);
                return (
                  <li key={`email-${i}`} className="flex items-center gap-2 text-[11.5px]">
                    <Mail size={12} className="shrink-0 text-ink-500 dark:text-ink-400" />
                    <span className="min-w-0 truncate text-ink-700 dark:text-ink-200">
                      {subject}
                      {from && <span className="text-ink-500 dark:text-ink-400"> · {from}</span>}
                    </span>
                    <span className="ml-auto shrink-0 text-[10px] uppercase tracking-[0.12em] text-ink-500 dark:text-ink-400">Intake</span>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* 8 + 9: confidence + retrieval summary footer */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-200 bg-white/60 px-3 py-2 text-[11px] text-ink-600 dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-300">
        <span className={cn("chip", CONFIDENCE_TONE[m.confidence] ?? "chip")}>{m.confidence} confidence</span>
        <span className="text-ink-500 dark:text-ink-400">·</span>
        <span>Updated {fmtDate(m.updated_at)}</span>
        {bundle.sources_checked.length > 0 && (
          <>
            <span className="text-ink-500 dark:text-ink-400">·</span>
            <span>Sources checked: {bundle.sources_checked.join(", ")}</span>
          </>
        )}
      </div>
      {bundle.retrieval_summary && (
        <p className="px-1 text-[10.5px] leading-snug text-ink-500 dark:text-ink-400">{bundle.retrieval_summary}</p>
      )}
    </div>
  );
}

// ─── Sample banner ────────────────────────────────────────────────────────────

function SampleBanner({ reason }: { reason: "sample-flag" | "no-loan" }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-status-warn/30 bg-status-warn/10 px-3 py-2 text-[11.5px] text-status-warn">
      <FlaskConical size={14} className="shrink-0" />
      <span className="font-medium">SAMPLE MODE</span>
      <span className="text-status-warn/90">
        {reason === "no-loan"
          ? "No live loan is connected. This is demo structure only — no real borrower data."
          : "Showing safe demo data (no real borrower). Live memory appears once the migration is applied and a loan is matched."}
      </span>
    </div>
  );
}

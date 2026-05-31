"use client";

// LegendsOS v2 — Gmail AI Intake review queue (client).
// -------------------------------------------------------------------------
// Read-only triage table with an expandable detail panel. Phase 1: NO sends,
// NO writes. Any action affordance is rendered disabled with a "Phase 2" tag
// so there are zero dead buttons — controls either work or are honestly
// labelled inert.

import { Fragment, useState } from "react";
import { ChevronDown, Mail, Paperclip } from "lucide-react";

import { cn, formatRelative } from "@/lib/utils";
import { INTAKE_CATEGORY_LABELS } from "@/lib/emailIntake/types";
import type { IntakeMessage } from "@/lib/emailIntake/types";

import {
  ClassificationChip,
  ConfidencePill,
  PhaseTwoTag,
  SampleBadge,
} from "./shared";

const STATUS_LABEL: Record<string, string> = {
  needs_review: "Needs review",
  classified: "Classified",
  loan_matched: "Loan matched",
  alert_pending: "Alert pending",
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  archived: "Archived",
};

function StatusChip({ status }: { status: string }) {
  const tone =
    status === "needs_review" || status === "alert_pending"
      ? "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-300"
      : status === "awaiting_approval"
        ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
        : status === "approved" || status === "loan_matched"
          ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300"
          : "border-ink-200 bg-ink-50 text-ink-600 dark:border-ink-700 dark:bg-ink-800/40 dark:text-ink-300";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tone
      )}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function ReviewQueue({ messages }: { messages: IntakeMessage[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (messages.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center gap-2 p-10 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full border border-ink-200 bg-ink-50 text-ink-400 dark:border-ink-800 dark:bg-ink-900/50 dark:text-ink-500">
          <Mail size={18} />
        </div>
        <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">
          Nothing waiting for review
        </p>
        <p className="max-w-md text-[12.5px] text-ink-600 dark:text-ink-300">
          When the intake webhook records an email it lands here for triage.
          The default filter shows items that need review or are awaiting
          approval.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-ink-200 dark:border-ink-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-ink-50 text-[10px] uppercase tracking-[0.14em] text-ink-500 dark:bg-ink-900/50 dark:text-ink-400">
          <tr>
            <th className="px-3 py-2 font-medium">From</th>
            <th className="px-3 py-2 font-medium">Subject</th>
            <th className="px-3 py-2 font-medium">Classification</th>
            <th className="px-3 py-2 font-medium">Conf.</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Received</th>
            <th className="px-3 py-2 font-medium text-right">Detail</th>
          </tr>
        </thead>
        <tbody>
          {messages.map((m) => {
            const isOpen = openId === m.id;
            return (
              <Fragment key={m.id}>
                <tr
                  className={cn(
                    "border-t border-ink-200 dark:border-ink-800",
                    isOpen
                      ? "bg-accent-gold/5"
                      : "bg-white hover:bg-ink-50 dark:bg-ink-950/40 dark:hover:bg-ink-900/40"
                  )}
                >
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium text-ink-900 dark:text-ink-100">
                        {m.from_name || m.from_address || "Unknown sender"}
                      </span>
                      {m.is_sample && <SampleBadge />}
                    </div>
                    {m.from_name && m.from_address && (
                      <p className="truncate text-[11px] text-ink-500 dark:text-ink-400">
                        {m.from_address}
                      </p>
                    )}
                  </td>
                  <td className="max-w-[20rem] px-3 py-2 align-top">
                    <div className="flex items-center gap-1.5">
                      {m.has_attachments && (
                        <Paperclip
                          size={12}
                          className="shrink-0 text-ink-400 dark:text-ink-500"
                        />
                      )}
                      <span className="truncate text-ink-800 dark:text-ink-200">
                        {m.subject || "(no subject)"}
                      </span>
                    </div>
                    {m.snippet && (
                      <p className="truncate text-[11px] text-ink-500 dark:text-ink-400">
                        {m.snippet}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <ClassificationChip category={m.classification} />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <ConfidencePill value={m.classification_confidence} />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <StatusChip status={m.status} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 align-top text-[11px] text-ink-500 dark:text-ink-400">
                    {formatRelative(m.received_at)}
                  </td>
                  <td className="px-3 py-2 align-top text-right">
                    <button
                      type="button"
                      onClick={() => setOpenId(isOpen ? null : m.id)}
                      aria-expanded={isOpen}
                      className="inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-white px-2 py-1 text-[11px] font-medium text-ink-700 hover:border-ink-300 dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-200"
                    >
                      {isOpen ? "Hide" : "Open"}
                      <ChevronDown
                        size={13}
                        className={cn("transition-transform", isOpen && "rotate-180")}
                      />
                    </button>
                  </td>
                </tr>
                {isOpen && (
                  <tr className="border-t border-ink-200 bg-ink-50/60 dark:border-ink-800 dark:bg-ink-900/30">
                    <td colSpan={7} className="px-4 py-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1.5 text-[12px]">
                          <dt className="text-ink-500 dark:text-ink-400">From</dt>
                          <dd className="text-ink-900 dark:text-ink-100">
                            {[m.from_name, m.from_address]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </dd>
                          <dt className="text-ink-500 dark:text-ink-400">To</dt>
                          <dd className="text-ink-900 dark:text-ink-100">
                            {m.to_address || "—"}
                          </dd>
                          <dt className="text-ink-500 dark:text-ink-400">
                            Source account
                          </dt>
                          <dd className="text-ink-900 dark:text-ink-100">
                            {m.source_account || "—"}
                          </dd>
                          <dt className="text-ink-500 dark:text-ink-400">
                            Subject
                          </dt>
                          <dd className="text-ink-900 dark:text-ink-100">
                            {m.subject || "(no subject)"}
                          </dd>
                          <dt className="text-ink-500 dark:text-ink-400">
                            Classified by
                          </dt>
                          <dd className="text-ink-900 dark:text-ink-100">
                            {m.classified_by === "none"
                              ? "Not yet classified"
                              : m.classified_by === "ai"
                                ? "AI (DeepSeek)"
                                : "Rule"}
                          </dd>
                          <dt className="text-ink-500 dark:text-ink-400">
                            Loan match
                          </dt>
                          <dd className="text-ink-900 dark:text-ink-100">
                            {m.loan_match_status === "unmatched"
                              ? "Unmatched"
                              : `${m.loan_match_status}${
                                  m.loan_match_confidence != null
                                    ? ` (${Math.round(
                                        m.loan_match_confidence * 100
                                      )}%)`
                                    : ""
                                }`}
                          </dd>
                        </dl>
                        <div className="space-y-2">
                          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-500 dark:text-ink-400">
                            Snippet
                          </p>
                          <p className="rounded-lg border border-ink-200 bg-white p-3 text-[12.5px] leading-relaxed text-ink-700 dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-200">
                            {m.snippet || "No preview text recorded."}
                          </p>
                          {m.classification && (
                            <p className="text-[11px] text-ink-500 dark:text-ink-400">
                              AI suggested:{" "}
                              <span className="text-ink-700 dark:text-ink-200">
                                {INTAKE_CATEGORY_LABELS[m.classification]}
                              </span>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Phase-2 action row. Honestly disabled — no dead
                          buttons. These become live once human-approval write
                          paths ship. */}
                      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink-200 pt-3 dark:border-ink-800">
                        <span className="text-[11px] text-ink-500 dark:text-ink-400">
                          Triage actions
                        </span>
                        {["Approve", "Reclassify", "Dismiss"].map((label) => (
                          <button
                            key={label}
                            type="button"
                            disabled
                            title="Available in Phase 2 — human-approval write paths are not enabled yet."
                            className="cursor-not-allowed rounded-lg border border-ink-200 bg-ink-50 px-2.5 py-1 text-[11px] font-medium text-ink-400 dark:border-ink-800 dark:bg-ink-900/40 dark:text-ink-500"
                          >
                            {label}
                          </button>
                        ))}
                        <PhaseTwoTag />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

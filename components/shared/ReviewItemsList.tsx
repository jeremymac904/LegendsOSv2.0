"use client";

import { useState } from "react";
import { ChevronDown, FileText, Inbox } from "lucide-react";

import { StatusPill } from "@/components/ui/StatusPill";
import { cn, formatRelative } from "@/lib/utils";
import {
  reviewStatusLabel,
  reviewStatusTone,
  type SharedReviewItem,
} from "@/lib/teamResources";

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-600 dark:text-ink-400">
        {label}
      </p>
      <p className="mt-0.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-800 dark:text-ink-200">
        {value}
      </p>
    </div>
  );
}

export function ReviewItemsList({ items }: { items: SharedReviewItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-ink-200 bg-white px-4 py-8 text-center dark:border-ink-800 dark:bg-ink-900/30">
        <Inbox size={20} className="text-ink-500 dark:text-ink-400" />
        <p className="text-[13px] font-medium text-ink-900 dark:text-ink-100">
          No review items yet
        </p>
        <p className="max-w-xs text-[12px] text-ink-600 dark:text-ink-400">
          Paste content or upload a file to create your first AI-reviewed draft.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {items.map((item) => {
        const open = openId === item.id;
        const rec = item.recommendation;
        return (
          <article
            key={item.id}
            className="overflow-hidden rounded-xl border border-ink-200 bg-white dark:border-ink-800 dark:bg-ink-900/40"
          >
            <button
              type="button"
              onClick={() => setOpenId(open ? null : item.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <FileText
                size={15}
                className="shrink-0 text-ink-600 dark:text-ink-400"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-ink-900 dark:text-ink-100">
                  {item.title}
                </p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-ink-500 dark:text-ink-400">
                  {item.inputKind.replace(/_/g, " ")} · updated{" "}
                  {formatRelative(item.updatedAt)}
                </p>
              </div>
              <StatusPill
                status={reviewStatusTone(item.reviewStatus)}
                label={reviewStatusLabel(item.reviewStatus)}
              />
              <ChevronDown
                size={15}
                className={cn(
                  "shrink-0 text-ink-500 transition-transform dark:text-ink-400",
                  open && "rotate-180"
                )}
              />
            </button>

            {open && (
              <div className="space-y-3 border-t border-ink-200 px-4 py-3 dark:border-ink-800">
                {item.file && (
                  <p className="rounded-lg border border-status-warn/30 bg-status-warn/10 px-3 py-2 text-[11.5px] leading-relaxed text-ink-700 dark:text-ink-300">
                    File: {item.file.name} — uploaded, pending text extraction.
                    AI review (if any) used the filename only.
                  </p>
                )}

                {item.reviewStatus === "pending_ai_review" && (
                  <p className="rounded-lg border border-status-warn/30 bg-status-warn/10 px-3 py-2 text-[11.5px] leading-relaxed text-ink-700 dark:text-ink-300">
                    {item.aiNote ??
                      "Pending AI review — no recommendations have been generated yet."}
                  </p>
                )}

                {rec ? (
                  <div className="grid gap-2.5">
                    <Field label="Description" value={rec.description} />
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <Field label="Category" value={rec.category} />
                      <Field label="Audience" value={rec.audience} />
                    </div>
                    <Field label="Team summary" value={rec.teamSummary} />
                    <Field label="Body" value={rec.body} />
                    <Field label="Sanitized version" value={rec.sanitizedVersion} />
                    <Field
                      label="Legends-voice rewrite"
                      value={rec.legendsVoiceRewrite}
                    />
                    <Field label="Compliance notes" value={rec.complianceNotes} />
                    {rec.shareStatus && (
                      <Field
                        label="Recommended share status"
                        value={rec.shareStatus.replace(/_/g, " ")}
                      />
                    )}
                    {item.aiProvider && (
                      <p className="text-[10px] text-ink-500 dark:text-ink-400">
                        Reviewed via {item.aiProvider}
                        {item.aiModel ? ` (${item.aiModel})` : ""}
                      </p>
                    )}
                  </div>
                ) : (
                  item.sourceText && (
                    <Field
                      label="Submitted content"
                      value={
                        item.sourceText.length > 600
                          ? `${item.sourceText.slice(0, 600)}…`
                          : item.sourceText
                      }
                    />
                  )
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

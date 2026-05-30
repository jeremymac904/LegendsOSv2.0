"use client";

import { useState } from "react";
import {
  ShieldCheck,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  PencilLine,
  Flag,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type DimensionStatus = "pass" | "needs_edit" | "escalate";

type Dimension = {
  status: DimensionStatus;
  note: string;
};

type ReviewResult = {
  verdict: DimensionStatus;
  dimensions: {
    brand: Dimension;
    compliance: Dimension;
    clarity: Dimension;
    cta: Dimension;
    risk: Dimension;
  };
  summary: string;
};

type ApiResponse =
  | { ok: true; provider: string; model: string; review: ReviewResult }
  | { ok: false; error: string; message: string };

const DIMENSION_META: {
  key: keyof ReviewResult["dimensions"];
  label: string;
}[] = [
  { key: "brand", label: "Brand voice" },
  { key: "compliance", label: "Compliance" },
  { key: "clarity", label: "Clarity" },
  { key: "cta", label: "Call to action" },
  { key: "risk", label: "Mortgage risk" },
];

const VERDICT_META: Record<
  DimensionStatus,
  { label: string; icon: LucideIcon; chip: string; badge: string }
> = {
  pass: {
    label: "Pass — looks publish-ready",
    icon: CheckCircle2,
    chip: "chip-ok",
    badge: "border-status-ok/40 bg-status-ok/15 text-status-ok",
  },
  needs_edit: {
    label: "Needs edits before publishing",
    icon: PencilLine,
    chip: "chip-warn",
    badge: "border-status-warn/40 bg-status-warn/15 text-status-warn",
  },
  escalate: {
    label: "Escalate — Jeremy should review personally",
    icon: Flag,
    chip: "chip-err",
    badge: "border-status-err/40 bg-status-err/15 text-status-err",
  },
};

function statusChipClass(status: DimensionStatus): string {
  return VERDICT_META[status].chip;
}

function statusLabel(status: DimensionStatus): string {
  return status === "pass"
    ? "Pass"
    : status === "needs_edit"
      ? "Needs edit"
      : "Escalate";
}

export function JeremyReviewPanel({ content }: { content: string }) {
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trimmed = content.trim();
  const disabled = loading || trimmed.length === 0;

  const runReview = async () => {
    setLoading(true);
    setError(null);
    setReview(null);
    try {
      const res = await fetch("/api/jeremy-review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });
      const data = (await res.json().catch(() => null)) as ApiResponse | null;
      if (!data) {
        setError("Couldn't reach the reviewer. Try again in a moment.");
        return;
      }
      if (data.ok) {
        setReview(data.review);
      } else {
        // Honest message straight from the API (ai_unavailable, review_failed,
        // unparseable, unauthenticated, bad_request).
        setError(data.message);
      }
    } catch {
      setError(
        "Couldn't reach the reviewer — check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const verdict = review ? VERDICT_META[review.verdict] : null;
  const VerdictIcon = verdict?.icon;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-gold/15 text-accent-gold">
            <ShieldCheck size={16} />
          </span>
          <div>
            <h4 className="text-[13px] font-semibold text-ink-900 dark:text-ink-100">
              Jeremy AI Review
            </h4>
            <p className="text-[11px] text-ink-500 dark:text-ink-400">
              Brand, compliance, clarity, CTA &amp; mortgage-risk check.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={runReview}
          disabled={disabled}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors",
            disabled
              ? "cursor-not-allowed border border-ink-200 bg-white/40 text-ink-400 dark:border-ink-800 dark:bg-ink-900/40 dark:text-ink-500"
              : "btn-primary",
          )}
          title={
            trimmed.length === 0
              ? "Add content first, then run the review"
              : "Run Jeremy AI Review"
          }
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <ShieldCheck size={14} />
          )}
          {loading ? "Reviewing…" : "Run Jeremy AI Review"}
        </button>
      </div>

      {trimmed.length === 0 && !review && !error && (
        <p className="text-[12px] leading-relaxed text-ink-500 dark:text-ink-400">
          Fill in the fields above to build your prompt, then run the review on
          the result.
        </p>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-status-warn/40 bg-status-warn/10 p-3">
          <AlertTriangle
            size={15}
            className="mt-0.5 shrink-0 text-status-warn"
          />
          <p className="text-[12px] leading-relaxed text-ink-700 dark:text-ink-200">
            {error}
          </p>
        </div>
      )}

      {review && verdict && VerdictIcon && (
        <div className="space-y-3">
          <div
            className={cn(
              "flex items-start gap-2 rounded-xl border p-3",
              verdict.badge,
            )}
          >
            <VerdictIcon size={16} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold">{verdict.label}</p>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-700 dark:text-ink-200">
                {review.summary}
              </p>
            </div>
          </div>

          <ul className="space-y-2">
            {DIMENSION_META.map((dim) => {
              const d = review.dimensions[dim.key];
              return (
                <li
                  key={dim.key}
                  className="flex items-start gap-3 rounded-xl border border-ink-200 bg-white/60 p-3 dark:border-ink-800 dark:bg-ink-950/40"
                >
                  <span
                    className={cn(
                      "mt-0.5 shrink-0",
                      statusChipClass(d.status),
                    )}
                  >
                    {statusLabel(d.status)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-ink-900 dark:text-ink-100">
                      {dim.label}
                    </p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-ink-600 dark:text-ink-300">
                      {d.note}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
            This is an AI pre-check, not a final sign-off. Jeremy still approves
            anything before it goes live.
          </p>
        </div>
      )}
    </div>
  );
}

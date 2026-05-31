"use client";

import { useState } from "react";
import {
  ShieldCheck,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  PencilLine,
  Flag,
  FileSearch,
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
    clarity: Dimension;
    compliance: Dimension;
    cta: Dimension;
    mortgageClaims: Dimension;
    missingInfo: Dimension;
  };
  summary: string;
};

type ReviewMode = "asset" | "brief";

type ApiResponse =
  | { ok: true; provider: string; model: string; review: ReviewResult }
  | { ok: false; error: string; message: string };

const DIMENSION_META: {
  key: keyof ReviewResult["dimensions"];
  label: string;
}[] = [
  { key: "brand", label: "Brand fit" },
  { key: "clarity", label: "Clarity" },
  { key: "compliance", label: "Compliance risk" },
  { key: "cta", label: "Call to action" },
  { key: "mortgageClaims", label: "Mortgage claims" },
  { key: "missingInfo", label: "Missing info" },
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

/**
 * Jeremy AI Review reviews the GENERATED ASSET, never the instruction prompt.
 *
 * The build panel can pass the filled prompt as `briefPreview` so the user can
 * optionally run a clearly-labeled *pre-check of the brief* — but the primary,
 * default review runs against the draft the user pastes in below (the actual
 * copy a reader will see). This avoids the false-compliance trap where the
 * prompt already lists the rules and therefore always "passes".
 */
export function JeremyReviewPanel({
  briefPreview,
}: {
  /** The filled instruction prompt, if this panel sits inside a builder. */
  briefPreview?: string;
}) {
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [reviewedMode, setReviewedMode] = useState<ReviewMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trimmedDraft = draft.trim();
  const trimmedBrief = (briefPreview ?? "").trim();
  const hasBrief = trimmedBrief.length > 0;

  const runReview = async (mode: ReviewMode) => {
    const content = mode === "asset" ? trimmedDraft : trimmedBrief;
    if (content.length === 0) return;
    setLoading(true);
    setError(null);
    setReview(null);
    setReviewedMode(null);
    try {
      const res = await fetch("/api/jeremy-review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content, mode }),
      });
      const data = (await res.json().catch(() => null)) as ApiResponse | null;
      if (!data) {
        setError("Couldn't reach the reviewer. Try again in a moment.");
        return;
      }
      if (data.ok) {
        setReview(data.review);
        setReviewedMode(mode);
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

  const assetDisabled = loading || trimmedDraft.length === 0;
  const briefDisabled = loading || !hasBrief;

  const verdict = review ? VERDICT_META[review.verdict] : null;
  const VerdictIcon = verdict?.icon;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-gold/15 text-accent-gold">
          <ShieldCheck size={16} />
        </span>
        <div>
          <h4 className="text-[13px] font-semibold text-ink-900 dark:text-ink-100">
            Jeremy AI Review — review your final asset
          </h4>
          <p className="text-[11px] text-ink-500 dark:text-ink-400">
            Reviews the generated copy you paste below, not the prompt above.
            Brand fit, clarity, compliance risk, CTA, mortgage claims &amp;
            missing info.
          </p>
        </div>
      </div>

      {/* Generated-draft input — THIS is what gets reviewed */}
      <div>
        <label
          htmlFor="jeremy-review-draft"
          className="mb-1 block text-[12px] font-medium text-ink-700 dark:text-ink-300"
        >
          Paste your generated draft to review
        </label>
        <textarea
          id="jeremy-review-draft"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={6}
          placeholder="Paste the copy your AI builder produced (the page text, blog post, email, etc.) — the actual words a reader will see. The review runs on this, not on the prompt."
          className="scrollbar-thin w-full resize-y rounded-xl border border-ink-200 bg-white/60 p-3 text-[12px] leading-relaxed text-ink-900 placeholder:text-ink-400 focus:border-accent-gold/50 focus:outline-none dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-100 dark:placeholder:text-ink-500"
        />
        <p className="mt-1 text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
          Generate your asset first (copy the prompt above into Atlas or your AI
          tool), then paste the result here so the review checks the real, final
          copy — not the instructions.
        </p>
      </div>

      <button
        type="button"
        onClick={() => runReview("asset")}
        disabled={assetDisabled}
        className={cn(
          "flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium transition-colors sm:w-auto",
          assetDisabled
            ? "cursor-not-allowed border border-ink-200 bg-white/40 text-ink-400 dark:border-ink-800 dark:bg-ink-900/40 dark:text-ink-500"
            : "btn-primary",
        )}
        title={
          trimmedDraft.length === 0
            ? "Paste your generated draft first, then run the review"
            : "Review your final generated asset"
        }
      >
        {loading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <ShieldCheck size={14} />
        )}
        {loading ? "Reviewing…" : "Review my final asset"}
      </button>

      {/* Optional, clearly-labeled brief pre-check (not the final asset) */}
      {hasBrief && (
        <div className="rounded-xl border border-dashed border-ink-200 bg-white/40 p-3 dark:border-ink-800 dark:bg-ink-950/30">
          <p className="text-[11px] leading-relaxed text-ink-600 dark:text-ink-300">
            Haven&apos;t generated the asset yet? You can run a{" "}
            <span className="font-semibold">pre-check of your brief</span> — this
            checks the prompt above is asking for the right things. It is{" "}
            <span className="font-semibold">not</span> a review of the final
            asset and is not a publish sign-off.
          </p>
          <button
            type="button"
            onClick={() => runReview("brief")}
            disabled={briefDisabled}
            className={cn(
              "mt-2 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors",
              briefDisabled
                ? "cursor-not-allowed border-ink-200 bg-white/40 text-ink-400 dark:border-ink-800 dark:bg-ink-900/40 dark:text-ink-500"
                : "border-ink-200 bg-white/60 text-ink-700 hover:bg-white dark:border-ink-800 dark:bg-ink-900/60 dark:text-ink-200 dark:hover:bg-ink-900",
            )}
          >
            <FileSearch size={13} />
            Pre-check my brief (not the final asset)
          </button>
        </div>
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
          {/* Make it unambiguous WHAT was reviewed */}
          <p
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
              reviewedMode === "brief"
                ? "border-status-warn/40 bg-status-warn/10 text-status-warn"
                : "border-ink-200 bg-white/60 text-ink-600 dark:border-ink-800 dark:bg-ink-900/60 dark:text-ink-300",
            )}
          >
            {reviewedMode === "brief" ? (
              <>
                <FileSearch size={12} />
                Pre-check of your brief (not the final asset)
              </>
            ) : (
              <>
                <ShieldCheck size={12} />
                Review of your final generated asset
              </>
            )}
          </p>

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
            {reviewedMode === "brief"
              ? "This only pre-checks your brief, not the final asset. Generate the asset, paste it above, and review that before anything goes live."
              : "This is an AI pre-check, not a final sign-off. Jeremy still approves anything before it goes live."}
          </p>
        </div>
      )}
    </div>
  );
}

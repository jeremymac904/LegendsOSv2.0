"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Check,
  Copy,
  FileText,
  Globe,
  Home,
  Lightbulb,
  Loader2,
  PenLine,
  Sparkles,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

import {
  VIBE_WORKFLOWS,
  type VibeKind,
  type VibeWorkflow,
} from "./workflows";
import { VibeReviewBadge, type VibeVerdict } from "./VibeReviewBadge";

const ICONS = { Home, PenLine, Globe, FileText, Lightbulb } as const;

// Mirrors the VibeReview shape returned by /api/vibe/review.
interface VibeReview {
  brand_fit: string;
  clarity: string;
  compliance_risk: string;
  cta: string;
  mortgage_claims: string;
  missing_info: string;
  final_verdict: VibeVerdict;
  summary: string;
}

type ReviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "reviewed"; review: VibeReview }
  | { status: "ai_not_configured"; message: string }
  | { status: "error"; message: string };

const ATLAS_PENDING_KEY = "atlas:pendingPrompt";

export function VibeWorkspace() {
  const router = useRouter();
  const [activeKind, setActiveKind] = useState<VibeKind | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [review, setReview] = useState<ReviewState>({ status: "idle" });

  const active = useMemo(
    () => VIBE_WORKFLOWS.find((w) => w.kind === activeKind) ?? null,
    [activeKind]
  );

  const prompt = useMemo(
    () => (active ? active.compose(values) : ""),
    [active, values]
  );

  const missingRequired = useMemo(() => {
    if (!active) return [];
    return active.fields
      .filter((f) => f.required && !(values[f.id] ?? "").trim())
      .map((f) => f.label);
  }, [active, values]);

  function openWorkflow(w: VibeWorkflow) {
    setActiveKind(w.kind);
    setValues({});
    setCopied(false);
    setReview({ status: "idle" });
  }

  function closePanel() {
    setActiveKind(null);
    setReview({ status: "idle" });
    setCopied(false);
  }

  function setField(id: string, value: string) {
    setValues((prev) => ({ ...prev, [id]: value }));
    // Editing invalidates a prior review so we never show a stale verdict.
    if (review.status !== "idle") setReview({ status: "idle" });
    setCopied(false);
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard can be blocked in some contexts; stay silent
    }
  }

  // SEND-TO-ATLAS CONTRACT: write the composed prompt to sessionStorage under
  // the exact key, then navigate to /atlas. AtlasWorkspace consumes it on mount.
  function sendToAtlas() {
    try {
      window.sessionStorage.setItem(ATLAS_PENDING_KEY, prompt);
    } catch {
      // If sessionStorage is unavailable we still navigate; the user can paste.
    }
    router.push("/atlas");
  }

  async function runReview() {
    if (!active) return;
    setReview({ status: "loading" });
    try {
      const res = await fetch("/api/vibe/review", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ content: prompt, kind: active.kind }),
      });
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) {
        setReview({
          status: "error",
          message:
            res.status === 401
              ? "Your session expired. Refresh and sign in again."
              : "The reviewer returned an unexpected response.",
        });
        return;
      }
      const data = await res.json();
      if (data.ok && data.status === "reviewed" && data.review) {
        setReview({ status: "reviewed", review: data.review as VibeReview });
      } else if (data.status === "ai_not_configured") {
        setReview({
          status: "ai_not_configured",
          message:
            data.message ??
            "Configure an AI provider in Settings to run Jeremy AI Review.",
        });
      } else {
        setReview({
          status: "error",
          message: data.message ?? "Jeremy AI Review could not complete. Try again.",
        });
      }
    } catch {
      setReview({ status: "error", message: "Network error running the review." });
    }
  }

  return (
    <div className="flex items-start gap-4">
      {/* Card grid */}
      <div className={cn("min-w-0 flex-1", active && "hidden lg:block")}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {VIBE_WORKFLOWS.map((w) => {
            const Icon = ICONS[w.icon];
            const isActive = activeKind === w.kind;
            return (
              <button
                key={w.kind}
                type="button"
                onClick={() => openWorkflow(w)}
                className={cn(
                  "card group flex flex-col items-start gap-2 p-4 text-left transition",
                  isActive && "ring-1 ring-accent-gold/50"
                )}
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl border border-accent-gold/30 bg-accent-gold/10 text-accent-gold">
                  <Icon size={16} />
                </span>
                <p className="text-[13px] font-semibold text-ink-900 dark:text-ink-100">
                  {w.title}
                </p>
                <p className="text-[11.5px] leading-snug text-ink-600 dark:text-ink-300">
                  {w.blurb}
                </p>
                <span className="mt-auto inline-flex items-center gap-1 pt-1 text-[11px] font-medium text-accent-gold opacity-80 transition group-hover:opacity-100">
                  Build a prompt <ArrowUpRight size={12} />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail panel — right column on desktop, full-screen modal on mobile */}
      {active && (
        <>
          {/* mobile scrim */}
          <div
            className="fixed inset-0 z-40 bg-ink-950/40 backdrop-blur-sm lg:hidden"
            onClick={closePanel}
            aria-hidden
          />
          <div
            className={cn(
              "z-50 flex flex-col overflow-hidden rounded-2xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-card",
              // mobile: fixed sheet; desktop: sticky side panel with its own scroll
              "fixed inset-x-3 bottom-3 top-16",
              "lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:w-[420px] lg:shrink-0 xl:w-[460px]"
            )}
          >
            <DetailPanel
              workflow={active}
              values={values}
              setField={setField}
              prompt={prompt}
              missingRequired={missingRequired}
              copied={copied}
              onCopy={copyPrompt}
              onSend={sendToAtlas}
              onClose={closePanel}
              review={review}
              onReview={runReview}
            />
          </div>
        </>
      )}
    </div>
  );
}

function DetailPanel({
  workflow,
  values,
  setField,
  prompt,
  missingRequired,
  copied,
  onCopy,
  onSend,
  onClose,
  review,
  onReview,
}: {
  workflow: VibeWorkflow;
  values: Record<string, string>;
  setField: (id: string, value: string) => void;
  prompt: string;
  missingRequired: string[];
  copied: boolean;
  onCopy: () => void;
  onSend: () => void;
  onClose: () => void;
  review: ReviewState;
  onReview: () => void;
}) {
  const Icon = ICONS[workflow.icon];
  return (
    <>
      {/* header */}
      <div className="flex items-center justify-between gap-2 border-b border-ink-200 dark:border-ink-800 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-accent-gold/30 bg-accent-gold/10 text-accent-gold">
            <Icon size={15} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-ink-900 dark:text-ink-100">
              {workflow.title}
            </p>
            <p className="truncate text-[11px] text-ink-600 dark:text-ink-300">
              {workflow.blurb}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300 hover:border-accent-gold/40 hover:text-accent-gold"
          aria-label="Close"
        >
          <X size={13} />
        </button>
      </div>

      {/* body (scrolls) */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 scrollbar-thin">
        {/* inputs */}
        <div className="space-y-3">
          {workflow.fields.map((f) => (
            <div key={f.id}>
              <label
                htmlFor={`vibe-${f.id}`}
                className="field-label mb-1 flex items-center gap-1.5"
              >
                {f.label}
                {f.required && <span className="text-accent-gold">*</span>}
              </label>
              {f.type === "textarea" ? (
                <textarea
                  id={`vibe-${f.id}`}
                  className="input min-h-[72px] leading-relaxed"
                  placeholder={f.placeholder}
                  value={values[f.id] ?? ""}
                  onChange={(e) => setField(f.id, e.target.value)}
                  rows={3}
                />
              ) : (
                <input
                  id={`vibe-${f.id}`}
                  type="text"
                  className="input"
                  placeholder={f.placeholder}
                  value={values[f.id] ?? ""}
                  onChange={(e) => setField(f.id, e.target.value)}
                />
              )}
              {f.hint && (
                <p className="mt-1 text-[10.5px] text-ink-500 dark:text-ink-400">{f.hint}</p>
              )}
            </div>
          ))}
        </div>

        {/* live prompt */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className="field-label">Generated prompt</p>
            {missingRequired.length > 0 && (
              <span className="text-[10px] text-status-warn">
                Add: {missingRequired.join(", ")}
              </span>
            )}
          </div>
          <pre className="max-h-[280px] overflow-auto whitespace-pre-wrap rounded-xl border border-ink-200 dark:border-ink-800 bg-ink-100/60 dark:bg-ink-950/60 p-3 text-[12px] leading-relaxed text-ink-800 dark:text-ink-200 scrollbar-thin">
{prompt}
          </pre>
        </div>

        {/* Jeremy AI Review result */}
        <VibeReviewResult state={review} />
      </div>

      {/* sticky action bar */}
      <div className="shrink-0 border-t border-ink-200 dark:border-ink-800 bg-white/90 dark:bg-ink-900/90 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onCopy} className="btn-secondary text-xs">
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy prompt"}
          </button>
          <button type="button" onClick={onSend} className="btn-secondary text-xs">
            <ArrowUpRight size={13} />
            Send to Atlas
          </button>
          <button
            type="button"
            onClick={onReview}
            disabled={review.status === "loading"}
            className="btn-primary ml-auto text-xs"
          >
            {review.status === "loading" ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Sparkles size={13} />
            )}
            Jeremy AI Review
          </button>
        </div>
        <p className="mt-2 text-[10px] leading-snug text-ink-500 dark:text-ink-400">
          Jeremy AI Review is an AI style review (Jeremy&apos;s reviewer persona), not a human
          approval. Verify any rate, payment, or approval claims before publishing.
        </p>
      </div>
    </>
  );
}

function VibeReviewResult({ state }: { state: ReviewState }) {
  if (state.status === "idle") return null;

  if (state.status === "loading") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-ink-200 dark:border-ink-800 bg-ink-100/60 dark:bg-ink-950/60 px-3 py-2.5 text-[12px] text-ink-600 dark:text-ink-300">
        <Loader2 size={13} className="animate-spin text-accent-gold" />
        Jeremy is reviewing your prompt…
      </div>
    );
  }

  if (state.status === "ai_not_configured") {
    return (
      <div className="rounded-xl border border-status-warn/30 bg-status-warn/10 px-3 py-2.5">
        <p className="text-[12px] font-medium text-status-warn">AI provider not configured</p>
        <p className="mt-1 text-[11px] leading-snug text-ink-700 dark:text-ink-300">
          {state.message} You can still Copy the prompt or Send it to Atlas.
        </p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-xl border border-status-err/30 bg-status-err/10 px-3 py-2.5">
        <p className="text-[12px] font-medium text-status-err">Review failed</p>
        <p className="mt-1 text-[11px] leading-snug text-ink-700 dark:text-ink-300">
          {state.message}
        </p>
      </div>
    );
  }

  const r = state.review;
  const rows: { label: string; value: string }[] = [
    { label: "Brand fit", value: r.brand_fit },
    { label: "Clarity", value: r.clarity },
    { label: "Compliance risk", value: r.compliance_risk },
    { label: "Call to action", value: r.cta },
    { label: "Mortgage claims", value: r.mortgage_claims },
    { label: "Missing info", value: r.missing_info },
  ];
  return (
    <div className="rounded-xl border border-accent-gold/30 bg-accent-gold/[0.05] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-gold">
          <Sparkles size={12} /> Jeremy AI Review
        </p>
        <VibeReviewBadge verdict={r.final_verdict} />
      </div>
      {r.summary && (
        <p className="mt-2 text-[12px] leading-relaxed text-ink-800 dark:text-ink-200">
          {r.summary}
        </p>
      )}
      <dl className="mt-3 space-y-2">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500 dark:text-ink-400">
              {row.label}
            </dt>
            <dd className="mt-0.5 text-[11.5px] leading-snug text-ink-700 dark:text-ink-300">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

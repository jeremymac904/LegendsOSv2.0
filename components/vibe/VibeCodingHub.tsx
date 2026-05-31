"use client";

import { useMemo, useState } from "react";
import {
  Sparkles,
  Home,
  FileText,
  Globe,
  BookOpen,
  Lightbulb,
  Copy,
  Check,
  ShieldCheck,
  CircleX,
  Wand2,
  ListChecks,
  X,
  ArrowUpRight,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  VIBE_PROMPT_TEMPLATES,
  VIBE_BUILD_CARDS,
  fillBuildPrompt,
  COMPLIANCE_SAFE_COPY,
  REVIEW_WORKFLOW_STEPS,
  type VibeBuildCard,
} from "@/lib/vibe/templates";
import { JeremyReviewPanel } from "@/components/vibe/JeremyReviewPanel";

type TabKey = "build" | "prompts" | "compliance" | "review";

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "build", label: "What you can build", icon: Sparkles },
  { key: "prompts", label: "Prompt templates", icon: Wand2 },
  { key: "compliance", label: "Compliance-safe copy", icon: ShieldCheck },
  { key: "review", label: "Jeremy review", icon: ListChecks },
];

const BUILD_ICONS: Record<VibeBuildCard["iconKey"], LucideIcon> = {
  home: Home,
  fileText: FileText,
  globe: Globe,
  bookOpen: BookOpen,
  lightbulb: Lightbulb,
};

export function VibeCodingHub() {
  const [tab, setTab] = useState<TabKey>("build");

  return (
    <div className="space-y-6">
      {/* Friendly intro */}
      <div className="glass-card-padded">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-gold/15 text-accent-gold">
            <Sparkles size={18} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-ink-900 dark:text-ink-100">
              You don&apos;t need to be a coder.
            </h2>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-600 dark:text-ink-300">
              &quot;Vibe coding&quot; just means describing what you want in plain
              words and letting AI build it. Use the ready-made prompts below,
              keep it compliant, and Jeremy reviews everything before it goes
              live. Simple and safe.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-colors",
                active
                  ? "border-accent-gold/50 bg-accent-gold/15 text-accent-gold"
                  : "border-ink-200 bg-white/60 text-ink-600 hover:bg-white dark:border-ink-800 dark:bg-ink-900/60 dark:text-ink-300 dark:hover:bg-ink-900",
              )}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "build" && <BuildSection />}
      {tab === "prompts" && <PromptsSection />}
      {tab === "compliance" && <ComplianceSection />}
      {tab === "review" && <ReviewSection />}
    </div>
  );
}

function BuildSection() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeCard = useMemo(
    () => VIBE_BUILD_CARDS.find((c) => c.id === activeId) ?? null,
    [activeId],
  );

  return (
    <div className="space-y-4">
      <div className="section-title">
        <h2>What you can build</h2>
        <p>
          Pick an asset type to open its builder — fill in the blanks, copy the
          prompt or send it straight to Atlas, then run the Jeremy AI Review.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {VIBE_BUILD_CARDS.map((c) => {
          const Icon = BUILD_ICONS[c.iconKey];
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveId(c.id)}
              className="card-padded group text-left transition-colors hover:border-accent-gold/40 hover:bg-white dark:hover:bg-ink-900/60"
              aria-label={`Open ${c.title} builder`}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-gold/15 text-accent-gold">
                <Icon size={18} />
              </span>
              <h3 className="mt-3 flex items-center gap-1 text-[14px] font-semibold text-ink-900 dark:text-ink-100">
                {c.title}
                <ChevronRight
                  size={14}
                  className="text-ink-400 transition-transform group-hover:translate-x-0.5 dark:text-ink-500"
                />
              </h3>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-600 dark:text-ink-400">
                {c.description}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-accent-gold">
                Open builder
              </span>
            </button>
          );
        })}
      </div>

      {activeCard && (
        <BuildDetailPanel
          card={activeCard}
          onClose={() => setActiveId(null)}
        />
      )}
    </div>
  );
}

function BuildDetailPanel({
  card,
  onClose,
}: {
  card: VibeBuildCard;
  onClose: () => void;
}) {
  const Icon = BUILD_ICONS[card.iconKey];
  const [values, setValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  const filledPrompt = useMemo(
    () => fillBuildPrompt(card, values),
    [card, values],
  );

  const setValue = (key: string, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(filledPrompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — keep the UI calm.
    }
  };

  const handleSendToAtlas = () => {
    // Open a real Builder agent session prefilled with this prompt.
    window.location.href = `/builder?prompt=${encodeURIComponent(filledPrompt)}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={`${card.title} builder`}
    >
      {/* Scrim */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close builder"
        className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm"
      />
      {/* Panel */}
      <div className="scrollbar-thin relative ml-auto flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-ink-200 bg-white shadow-glass dark:border-ink-800 dark:bg-ink-950">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-ink-200 bg-white/95 p-5 backdrop-blur dark:border-ink-800 dark:bg-ink-950/95">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-gold/15 text-accent-gold">
              <Icon size={18} />
            </span>
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-ink-900 dark:text-ink-100">
                {card.title}
              </h3>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-600 dark:text-ink-300">
                {card.whatItCreates}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close builder"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-ink-200 text-ink-600 hover:bg-ink-100 dark:border-ink-800 dark:text-ink-300 dark:hover:bg-ink-900"
          >
            <X size={15} />
          </button>
        </div>

        <div className="space-y-5 p-5">
          {/* Inputs */}
          <div className="space-y-3">
            <p className="label">Fill in your details</p>
            {card.inputs.map((input) => (
              <div key={input.key}>
                <label
                  htmlFor={`${card.id}-${input.key}`}
                  className="mb-1 block text-[12px] font-medium text-ink-700 dark:text-ink-300"
                >
                  {input.label}
                </label>
                <input
                  id={`${card.id}-${input.key}`}
                  type="text"
                  className="input"
                  placeholder={input.placeholder}
                  value={values[input.key] ?? ""}
                  onChange={(e) => setValue(input.key, e.target.value)}
                />
              </div>
            ))}
            <p className="text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
              Anything you leave blank shows up as a clearly-marked
              [placeholder] in the prompt so nothing is faked.
            </p>
          </div>

          {/* Prompt preview */}
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="label mb-0">Your prompt</p>
              <button
                type="button"
                onClick={handleCopy}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors",
                  copied
                    ? "border-status-ok/40 bg-status-ok/15 text-status-ok"
                    : "border-ink-200 bg-white/60 text-ink-700 hover:bg-white dark:border-ink-800 dark:bg-ink-900/60 dark:text-ink-200 dark:hover:bg-ink-900",
                )}
                aria-label="Copy prompt"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied!" : "Copy prompt"}
              </button>
            </div>
            <pre className="scrollbar-thin max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-ink-200 bg-white/50 p-3 text-[12px] leading-relaxed text-ink-700 dark:border-ink-800 dark:bg-ink-950/50 dark:text-ink-300">
              {filledPrompt}
            </pre>
          </div>

          {/* Send to Atlas */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSendToAtlas}
              className="btn-primary flex items-center gap-1.5"
            >
              <ArrowUpRight size={14} />
              Open in Builder
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="btn-secondary flex items-center gap-1.5"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied!" : "Copy prompt"}
            </button>
          </div>

          {/* Jeremy AI Review — reviews the GENERATED asset (pasted below),
              not the prompt above. The filled prompt is passed only as an
              optional brief pre-check. */}
          <div className="rounded-xl border border-ink-200 bg-white/60 p-4 dark:border-ink-800 dark:bg-ink-950/40">
            <JeremyReviewPanel briefPreview={filledPrompt} />
          </div>
        </div>
      </div>
    </div>
  );
}

function PromptsSection() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (id: string, prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedId(id);
      window.setTimeout(() => {
        setCopiedId((current) => (current === id ? null : current));
      }, 2000);
    } catch {
      // Clipboard unavailable — silently ignore so the UI stays calm.
    }
  };

  return (
    <div className="space-y-4">
      <div className="section-title">
        <h2>Prompt templates</h2>
        <p>Copy a prompt, paste it into your AI tool, and fill in the blanks.</p>
      </div>
      <div className="space-y-4">
        {VIBE_PROMPT_TEMPLATES.map((tpl) => {
          const copied = copiedId === tpl.id;
          return (
            <div key={tpl.id} className="card-padded">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-[14px] font-semibold text-ink-900 dark:text-ink-100">
                    {tpl.title}
                  </h3>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-600 dark:text-ink-400">
                    {tpl.description}
                  </p>
                  <p className="mt-2 inline-flex items-center gap-1.5">
                    <span className="chip-info">Best for: {tpl.useCase}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(tpl.id, tpl.prompt)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors",
                    copied
                      ? "border-status-ok/40 bg-status-ok/15 text-status-ok"
                      : "border-ink-200 bg-white/60 text-ink-700 hover:bg-white dark:border-ink-800 dark:bg-ink-900/60 dark:text-ink-200 dark:hover:bg-ink-900",
                  )}
                  aria-label={`Copy ${tpl.title} prompt`}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <pre className="scrollbar-thin mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl border border-ink-200 bg-white/50 p-3 text-[12px] leading-relaxed text-ink-700 dark:border-ink-800 dark:bg-ink-950/50 dark:text-ink-300">
                {tpl.prompt}
              </pre>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ComplianceSection() {
  return (
    <div className="space-y-4">
      <div className="section-title">
        <h2>Compliance-safe copy</h2>
        <p>
          Stay on the right side of the rules. When in doubt, soften it and ask
          Jeremy.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card-padded">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-status-ok/15 text-status-ok">
              <ShieldCheck size={16} />
            </span>
            <h3 className="text-[14px] font-semibold text-ink-900 dark:text-ink-100">
              Approved phrasing
            </h3>
          </div>
          <ul className="mt-3 space-y-2">
            {COMPLIANCE_SAFE_COPY.approved.map((line) => (
              <li
                key={line}
                className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-700 dark:text-ink-300"
              >
                <Check
                  size={14}
                  className="mt-0.5 shrink-0 text-status-ok"
                />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card-padded">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-status-err/15 text-status-err">
              <CircleX size={16} />
            </span>
            <h3 className="text-[14px] font-semibold text-ink-900 dark:text-ink-100">
              Things to avoid
            </h3>
          </div>
          <ul className="mt-3 space-y-2">
            {COMPLIANCE_SAFE_COPY.avoid.map((line) => (
              <li
                key={line}
                className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-700 dark:text-ink-300"
              >
                <CircleX
                  size={14}
                  className="mt-0.5 shrink-0 text-status-err"
                />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="glass-card-padded">
        <p className="text-[12px] leading-relaxed text-ink-600 dark:text-ink-300">
          <span className="chip-warn mr-2">Good to know</span>
          {COMPLIANCE_SAFE_COPY.note}
        </p>
      </div>
    </div>
  );
}

function ReviewSection() {
  return (
    <div className="space-y-4">
      <div className="section-title">
        <h2>Jeremy review workflow</h2>
        <p>Four simple steps from idea to published. No surprises.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {REVIEW_WORKFLOW_STEPS.map((s) => (
          <div key={s.step} className="card-padded">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-gold/15 text-[14px] font-semibold text-accent-gold">
                {s.step}
              </span>
              <h3 className="text-[14px] font-semibold text-ink-900 dark:text-ink-100">
                {s.title}
              </h3>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-600 dark:text-ink-400">
              {s.detail}
            </p>
          </div>
        ))}
      </div>
      <div className="glass-card-padded">
        <p className="text-[12px] leading-relaxed text-ink-600 dark:text-ink-300">
          <span className="chip-active mr-2">Remember</span>
          Nothing goes live without Jeremy&apos;s approval. That&apos;s your
          safety net — build freely, and let the review catch anything before
          it&apos;s public.
        </p>
      </div>
    </div>
  );
}

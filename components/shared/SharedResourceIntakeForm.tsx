"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  FileUp,
  Sparkles,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  SHARED_REVIEW_INPUT_KINDS,
  type SharedReviewInputKind,
  type SharedReviewRecommendation,
} from "@/lib/teamResources";

interface IntakeResponse {
  ok: boolean;
  id?: string;
  review_status?: "pending_ai_review" | "ai_reviewed";
  recommendation?: SharedReviewRecommendation | null;
  ai_provider?: string | null;
  ai_model?: string | null;
  ai_note?: string | null;
  error?: string;
  message?: string;
}

// Browser can extract text from these; binary types are stored
// "pending text extraction" instead.
const TEXT_FILE_EXT = [".txt", ".md", ".markdown", ".vtt", ".srt", ".csv"];
const BINARY_FILE_EXT = [".pdf", ".docx", ".doc"];

function hasExt(name: string, list: string[]): boolean {
  const lower = name.toLowerCase();
  return list.some((ext) => lower.endsWith(ext));
}

function RecommendationField({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  async function copy() {
    try {
      await navigator.clipboard.writeText(value!);
    } catch {
      /* clipboard unavailable — silent */
    }
  }
  return (
    <div className="rounded-lg border border-ink-200 bg-white p-3 dark:border-ink-800 dark:bg-ink-900/40">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-600 dark:text-ink-400">
          {label}
        </p>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 text-[10px] text-ink-600 transition hover:text-accent-orange dark:text-ink-400 dark:hover:text-accent-gold"
        >
          <Copy size={11} />
          Copy
        </button>
      </div>
      <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-800 dark:text-ink-200">
        {value}
      </p>
    </div>
  );
}

export function SharedResourceIntakeForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [inputKind, setInputKind] = useState<SharedReviewInputKind>("pasted");
  const [sourceText, setSourceText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IntakeResponse | null>(null);
  const [isPending, startTransition] = useTransition();

  const isUpload = inputKind === "uploaded_file";
  const isBinaryFile = file ? hasExt(file.name, BINARY_FILE_EXT) : false;

  function onFilePicked(picked: File | null) {
    setError(null);
    setFile(picked);
    if (!picked) return;
    // If the picked file is text-readable, pull its text so AI can review it
    // fully. Binary files (PDF/DOCX) are accepted as "pending text extraction".
    if (hasExt(picked.name, TEXT_FILE_EXT)) {
      const reader = new FileReader();
      reader.onload = () => {
        const text = typeof reader.result === "string" ? reader.result : "";
        setSourceText(text);
        // A readable file behaves like pasted text for the AI step.
        setInputKind("plain_text");
        setFile(null);
      };
      reader.readAsText(picked);
    } else if (hasExt(picked.name, BINARY_FILE_EXT)) {
      setInputKind("uploaded_file");
    } else {
      // Unknown — try reading as text; if it is genuinely binary the user
      // still gets the honest "pending extraction" path via the file branch.
      setInputKind("uploaded_file");
    }
  }

  function reset() {
    setTitle("");
    setSourceText("");
    setFile(null);
    setInputKind("pasted");
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (isUpload && !file) {
      setError("Choose a file to upload, or switch to a text-based input.");
      return;
    }
    if (!isUpload && !sourceText.trim()) {
      setError("Paste or type content to review.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/shared/intake", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: title.trim() || undefined,
            input_kind: inputKind,
            source_text: isUpload ? "" : sourceText,
            file:
              isUpload && file
                ? { name: file.name, type: file.type, size: file.size }
                : null,
          }),
        });
        const json = (await res.json()) as IntakeResponse;
        if (!json.ok) {
          setError(json.message ?? "Could not create the review item.");
          return;
        }
        setResult(json);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Request failed.");
      }
    });
  }

  const rec = result?.recommendation ?? null;
  const reviewed = result?.review_status === "ai_reviewed";

  return (
    <div className="card-padded space-y-4">
      <div>
        <p className="label">Add a resource for review</p>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-600 dark:text-ink-400">
          Paste content or upload a file. An AI step recommends a title,
          summary, category, audience, sanitized + Legends-voice versions, and
          compliance notes. Nothing goes live to the team until you publish it.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <input
          className="input"
          placeholder="Title (optional — AI will suggest one)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={160}
        />

        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.16em] text-ink-600 dark:text-ink-400">
            Input type
          </label>
          <select
            className="input"
            value={inputKind}
            onChange={(e) => {
              const next = e.target.value as SharedReviewInputKind;
              setInputKind(next);
              if (next !== "uploaded_file") setFile(null);
            }}
          >
            {SHARED_REVIEW_INPUT_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>

        {isUpload ? (
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt,.md,.markdown,.vtt,.srt,.csv"
              className="hidden"
              onChange={(e) => onFilePicked(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-ink-300 bg-white px-4 py-6 text-[12.5px] text-ink-600 transition hover:border-accent-gold/50 hover:text-ink-800 dark:border-ink-700 dark:bg-ink-900/40 dark:text-ink-400 dark:hover:text-ink-200"
            >
              <FileUp size={16} />
              {file ? "Choose a different file" : "Choose a file (PDF, DOCX, TXT, MD)"}
            </button>
            {file && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-[12px] dark:border-ink-800 dark:bg-ink-900/40">
                <span className="truncate text-ink-800 dark:text-ink-200">
                  {file.name}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="text-ink-500 transition hover:text-status-err"
                  aria-label="Remove file"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            {isBinaryFile && (
              <p className="flex items-start gap-1.5 rounded-lg border border-status-warn/30 bg-status-warn/10 px-3 py-2 text-[11.5px] leading-relaxed text-ink-700 dark:text-ink-300">
                <AlertTriangle size={13} className="mt-0.5 shrink-0 text-status-warn" />
                Stored as &ldquo;uploaded — pending text extraction.&rdquo; We
                accept the file but do not parse PDF/DOCX text yet, so AI review
                works from the filename only. Paste the text for a full review.
              </p>
            )}
          </div>
        ) : (
          <textarea
            className="textarea min-h-[180px]"
            placeholder="Paste content, transcript, markdown, or a YouTube transcript here…"
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            maxLength={60000}
          />
        )}

        {error && (
          <p className="rounded-lg border border-status-err/30 bg-status-err/10 px-3 py-2 text-xs text-status-err">
            {error}
          </p>
        )}

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="btn-primary flex-1"
            disabled={isPending}
          >
            <Sparkles size={14} />
            {isPending ? "Reviewing…" : "Create review item"}
          </button>
          {(result || sourceText || file || title) && (
            <button
              type="button"
              onClick={reset}
              className="btn-ghost"
              disabled={isPending}
            >
              Reset
            </button>
          )}
        </div>
      </form>

      {result && (
        <div className="space-y-3 border-t border-ink-200 pt-4 dark:border-ink-800">
          <div
            className={cn(
              "flex items-start gap-2 rounded-lg px-3 py-2.5 text-[12.5px] leading-relaxed",
              reviewed
                ? "border border-status-ok/30 bg-status-ok/10 text-ink-800 dark:text-ink-200"
                : "border border-status-warn/30 bg-status-warn/10 text-ink-800 dark:text-ink-200"
            )}
          >
            {reviewed ? (
              <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-status-ok" />
            ) : (
              <Clock size={15} className="mt-0.5 shrink-0 text-status-warn" />
            )}
            <span>
              {reviewed ? (
                <>
                  AI review complete
                  {result.ai_provider ? ` via ${result.ai_provider}` : ""}. Saved
                  as a draft for your review — not yet shared with the team.
                </>
              ) : (
                <>
                  Saved as <strong>pending AI review</strong>.{" "}
                  {result.ai_note ??
                    "An AI provider was not available, so no recommendations were generated."}
                </>
              )}
            </span>
          </div>

          {rec && (
            <div className="grid gap-2">
              <RecommendationField label="Suggested title" value={rec.title} />
              <RecommendationField label="Description" value={rec.description} />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <RecommendationField label="Category" value={rec.category} />
                <RecommendationField label="Audience" value={rec.audience} />
              </div>
              <RecommendationField label="Team summary" value={rec.teamSummary} />
              <RecommendationField label="Body" value={rec.body} />
              <RecommendationField
                label="Sanitized version"
                value={rec.sanitizedVersion}
              />
              <RecommendationField
                label="Legends-voice rewrite"
                value={rec.legendsVoiceRewrite}
              />
              <RecommendationField
                label="Compliance notes"
                value={rec.complianceNotes}
              />
              {rec.shareStatus && (
                <RecommendationField
                  label="Recommended share status"
                  value={rec.shareStatus.replace(/_/g, " ")}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

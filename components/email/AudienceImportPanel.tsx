"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CloudUpload, FileText, RotateCw } from "lucide-react";

import { StatusPill } from "@/components/ui/StatusPill";
import { cn, formatRelative, truncate } from "@/lib/utils";
import type { NewsletterContactImport } from "@/types/database";

interface PreviewRow {
  values: string[];
}

interface Props {
  audienceId: string;
  imports: NewsletterContactImport[];
}

const MAX_BYTES = 20 * 1024 * 1024;

export function AudienceImportPanel({ audienceId, imports }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<NewsletterContactImport | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleFile(f: File | null) {
    setError(null);
    setInfo(null);
    setSummary(null);
    setFile(f);
    setHeaders([]);
    setPreviewRows([]);
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setError(`File is ${(f.size / 1024 / 1024).toFixed(1)} MB; max 20 MB.`);
      return;
    }
    // Sample first ~64KB for the preview only.
    const slice = f.slice(0, 64 * 1024);
    slice.text().then((text) => {
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length === 0) return;
      const parsedLines = lines.slice(0, 11).map(parseCsvLine);
      setHeaders(parsedLines[0] ?? []);
      setPreviewRows(parsedLines.slice(1, 11).map((values) => ({ values })));
    });
  }

  function submit() {
    if (!file) {
      setError("Pick a CSV file first.");
      return;
    }
    setError(null);
    setInfo(null);
    setSummary(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("audience_id", audienceId);
        const res = await fetch("/api/email/audiences/import", {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        if (!data.ok) {
          setError(`${data.error}: ${data.message}`);
          return;
        }
        setSummary(data.import as NewsletterContactImport);
        setInfo(`Imported ${data.stats.inserted_count} new + ${data.stats.updated_count} updated.`);
        // Clear the file so we don't accidentally re-import.
        if (fileRef.current) fileRef.current.value = "";
        setFile(null);
        setHeaders([]);
        setPreviewRows([]);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed.");
      }
    });
  }

  // Auto-refresh the imports list if the most-recent one is still processing
  useEffect(() => {
    if (imports[0]?.status === "processing") {
      const t = setTimeout(() => router.refresh(), 4000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [imports, router]);

  return (
    <section className="card-padded space-y-3">
      <div className="section-title">
        <div>
          <h2>Import contacts</h2>
          <p>
            Upload a CSV — columns are auto-detected (Full Name, Email, Office
            Name, City, State, Volume, …). The first 10 rows preview here
            before you commit.
          </p>
        </div>
      </div>

      <label
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-ink-900/40 p-6 text-center transition",
          file
            ? "border-accent-gold/40 bg-accent-gold/5"
            : "border-ink-700 text-ink-300 hover:border-ink-500"
        )}
      >
        <CloudUpload size={22} />
        <p className="mt-2 text-sm font-medium text-ink-100">
          {file ? truncate(file.name, 50) : "Choose a CSV file"}
        </p>
        <p className="text-[11px] text-ink-300">
          {file
            ? `${Math.round(file.size / 1024)} KB · click again to replace`
            : "Up to 20 MB. RFC4180 quoting supported."}
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </label>

      {headers.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-ink-800">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-ink-900/70 text-[10px] uppercase tracking-[0.18em] text-ink-300">
              <tr>
                {headers.map((h, i) => (
                  <th key={i} className="px-2 py-1.5 whitespace-nowrap">
                    {truncate(h, 18)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((r, i) => (
                <tr key={i} className="border-t border-ink-800">
                  {r.values.map((v, j) => (
                    <td
                      key={j}
                      className="max-w-[140px] truncate px-2 py-1 text-ink-200"
                    >
                      {truncate(v, 22)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-ink-800 bg-ink-900/40 px-2 py-1 text-[10px] text-ink-300">
            Preview of first 10 data rows. The full file is parsed server-side.
          </p>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-status-err/30 bg-status-err/10 px-3 py-2 text-xs text-status-err">
          {error}
        </p>
      )}
      {info && (
        <p className="rounded-lg border border-status-ok/30 bg-status-ok/10 px-3 py-2 text-xs text-status-ok">
          {info}
        </p>
      )}

      <button
        type="button"
        className="btn-primary w-full"
        onClick={submit}
        disabled={isPending || !file}
      >
        {isPending ? (
          <>
            <RotateCw size={14} className="animate-spin" />
            Importing…
          </>
        ) : (
          <>
            <CloudUpload size={14} />
            Import contacts
          </>
        )}
      </button>

      {summary && <ImportSummary summary={summary} />}

      <div>
        <p className="label">Recent imports</p>
        <div className="mt-2 space-y-1">
          {imports.length === 0 ? (
            <p className="text-[11px] text-ink-300">No imports yet.</p>
          ) : (
            imports.map((imp) => <ImportRow key={imp.id} imp={imp} />)
          )}
        </div>
      </div>
    </section>
  );
}

function ImportSummary({ summary }: { summary: NewsletterContactImport }) {
  return (
    <div className="rounded-xl border border-ink-800 bg-ink-900/40 p-3 text-xs">
      <div className="flex items-center justify-between">
        <p className="font-medium text-ink-100">Import summary</p>
        <StatusPill status={statusToPill(summary.status)} label={summary.status} />
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-ink-200 sm:grid-cols-3">
        <li>
          Total: <span className="text-ink-100">{summary.total_rows}</span>
        </li>
        <li>
          New: <span className="text-status-ok">{summary.inserted_count}</span>
        </li>
        <li>
          Updated: <span className="text-status-info">{summary.updated_count}</span>
        </li>
        <li>
          In-file dupes:{" "}
          <span className="text-ink-300">{summary.duplicate_count}</span>
        </li>
        <li>
          Missing email:{" "}
          <span className="text-status-warn">{summary.missing_email_count}</span>
        </li>
        <li>
          Errors:{" "}
          <span className="text-status-err">{summary.error_count}</span>
        </li>
      </ul>
      {summary.errors && summary.errors.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[10px] uppercase tracking-[0.18em] text-ink-300">
            View first {Math.min(10, summary.errors.length)} row error(s)
          </summary>
          <ul className="mt-1 space-y-0.5 text-[11px] text-ink-300">
            {summary.errors.slice(0, 10).map((e, i) => (
              <li key={i}>
                row {e.row}: {e.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function ImportRow({ imp }: { imp: NewsletterContactImport }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-ink-800 bg-ink-900/40 px-2 py-1.5 text-[11px]">
      <div className="flex items-center gap-2 min-w-0">
        <FileText size={11} className="shrink-0 text-ink-300" />
        <span className="truncate text-ink-200">
          {truncate(imp.source_file_name ?? "uploaded.csv", 28)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-ink-300">
          {imp.inserted_count}+{imp.updated_count}
        </span>
        <StatusPill status={statusToPill(imp.status)} label={imp.status} />
        <span className="text-ink-400">
          {formatRelative(imp.completed_at ?? imp.started_at ?? imp.created_at)}
        </span>
      </div>
    </div>
  );
}

function statusToPill(s: string) {
  if (s === "succeeded") return "ok" as const;
  if (s === "partial") return "warn" as const;
  if (s === "failed") return "err" as const;
  if (s === "processing") return "info" as const;
  return "off" as const;
}

// Lightweight CSV line parser for the *preview only*. The server uses the
// full parser. We accept double-quoted fields and "" escapes.
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQ = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ",") {
      out.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out;
}


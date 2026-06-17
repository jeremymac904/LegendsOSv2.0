"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FilePlus2, Upload } from "lucide-react";

type IntakeRow = {
  borrower_name: string;
  email?: string;
  phone?: string;
  property_address?: string;
  loan_program?: string;
  loan_purpose?: string;
  loan_number?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  notes?: string;
  next_action?: string;
};

type ImportPreview = {
  row: IntakeRow;
  errors: string[];
};

const SAMPLE_CSV =
  "borrower_name,email,phone,property_address,loan_program,loan_purpose,loan_number,priority,next_action,notes\n" +
  "Taylor Johnson,taylor@example.com,555-0100,\"123 Main St, Jacksonville FL\",Conventional,purchase,LO-1001,normal,Call borrower for docs,New onboarding sample";

const PURPOSES = [
  "purchase",
  "rate_term_refinance",
  "cash_out_refinance",
  "heloc",
  "construction",
  "other",
] as const;

function normalizePriority(value: string | undefined): IntakeRow["priority"] {
  const raw = (value ?? "normal").trim().toLowerCase();
  return raw === "low" || raw === "high" || raw === "urgent" ? raw : "normal";
}

function normalizePurpose(value: string | undefined): string {
  const raw = (value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  return PURPOSES.includes(raw as (typeof PURPOSES)[number]) ? raw : "other";
}

function validateRow(row: IntakeRow): string[] {
  const errors: string[] = [];
  if (!row.borrower_name?.trim()) errors.push("borrower_name is required");
  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
    errors.push("email is invalid");
  }
  if (row.priority && !["low", "normal", "high", "urgent"].includes(row.priority)) {
    errors.push("priority must be low, normal, high, or urgent");
  }
  return errors;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function csvToPreview(text: string): ImportPreview[] {
  const rows = parseCsv(text);
  const [header = [], ...body] = rows;
  const keys = header.map((h) => h.trim().toLowerCase());
  return body.map((values) => {
    const record = Object.fromEntries(keys.map((key, index) => [key, values[index] ?? ""]));
    const row: IntakeRow = {
      borrower_name: String(record.borrower_name ?? "").trim(),
      email: String(record.email ?? "").trim() || undefined,
      phone: String(record.phone ?? "").trim() || undefined,
      property_address: String(record.property_address ?? "").trim() || undefined,
      loan_program: String(record.loan_program ?? "").trim() || undefined,
      loan_purpose: normalizePurpose(String(record.loan_purpose ?? "")),
      loan_number: String(record.loan_number ?? "").trim() || undefined,
      priority: normalizePriority(String(record.priority ?? "")),
      next_action: String(record.next_action ?? "").trim() || undefined,
      notes: String(record.notes ?? "").trim() || undefined,
    };
    return { row, errors: validateRow(row) };
  });
}

async function submitRows(rows: IntakeRow[]) {
  const res = await fetch("/api/loans/intake", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ rows }),
  });
  return (await res.json()) as {
    ok: boolean;
    created?: number;
    error?: string;
    message?: string;
  };
}

export function LoanIntakePanel() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [manual, setManual] = useState<IntakeRow>({
    borrower_name: "",
    loan_purpose: "purchase",
    priority: "normal",
  });
  const [preview, setPreview] = useState<ImportPreview[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const validPreview = useMemo(
    () => preview.filter((item) => item.errors.length === 0),
    [preview]
  );

  function update<K extends keyof IntakeRow>(key: K, value: IntakeRow[K]) {
    setManual((current) => ({ ...current, [key]: value }));
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([SAMPLE_CSV], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "legendsos-loan-intake-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function loadCsv(file: File | undefined) {
    if (!file) return;
    setError(null);
    setMessage(null);
    const text = await file.text();
    const next = csvToPreview(text);
    setPreview(next);
    if (next.length === 0) {
      setError("No import rows found. Use the sample CSV headers.");
    }
  }

  function saveManual() {
    const row: IntakeRow = {
      ...manual,
      loan_purpose: normalizePurpose(manual.loan_purpose),
      priority: normalizePriority(manual.priority),
    };
    const errors = validateRow(row);
    if (errors.length > 0) {
      setError(errors.join("; "));
      return;
    }
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await submitRows([row]);
      if (!result.ok) {
        setError(result.message ?? result.error ?? "Could not save loan draft.");
        return;
      }
      setMessage("Saved 1 local intake draft.");
      setManual({ borrower_name: "", loan_purpose: "purchase", priority: "normal" });
      router.refresh();
    });
  }

  function importCsv() {
    if (validPreview.length === 0) {
      setError("No valid CSV rows to import.");
      return;
    }
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await submitRows(validPreview.map((item) => item.row));
      if (!result.ok) {
        setError(result.message ?? result.error ?? "CSV import failed.");
        return;
      }
      setMessage(`Imported ${result.created ?? validPreview.length} local intake drafts.`);
      setPreview([]);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    });
  }

  return (
    <section className="card-padded space-y-5">
      <div className="section-title">
        <div>
          <h2>Add customer / loan</h2>
          <p>
            Local intake drafts only. No LOS writes, no CRM sync, and no Drive
            folder changes.
          </p>
        </div>
        <span className="chip-warn">Sample / local intake</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="field-label">Borrower name</span>
              <input
                className="input"
                value={manual.borrower_name}
                onChange={(e) => update("borrower_name", e.target.value)}
                placeholder="Borrower full name"
              />
            </label>
            <label className="space-y-1.5">
              <span className="field-label">Email</span>
              <input
                className="input"
                type="email"
                value={manual.email ?? ""}
                onChange={(e) => update("email", e.target.value)}
                placeholder="borrower@example.com"
              />
            </label>
            <label className="space-y-1.5">
              <span className="field-label">Phone</span>
              <input
                className="input"
                value={manual.phone ?? ""}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="555-0100"
              />
            </label>
            <label className="space-y-1.5">
              <span className="field-label">Loan number</span>
              <input
                className="input"
                value={manual.loan_number ?? ""}
                onChange={(e) => update("loan_number", e.target.value)}
                placeholder="Optional"
              />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="field-label">Property address</span>
              <input
                className="input"
                value={manual.property_address ?? ""}
                onChange={(e) => update("property_address", e.target.value)}
                placeholder="Optional property address"
              />
            </label>
            <label className="space-y-1.5">
              <span className="field-label">Program</span>
              <input
                className="input"
                value={manual.loan_program ?? ""}
                onChange={(e) => update("loan_program", e.target.value)}
                placeholder="Conventional, FHA, VA..."
              />
            </label>
            <label className="space-y-1.5">
              <span className="field-label">Priority</span>
              <select
                className="input"
                value={manual.priority ?? "normal"}
                onChange={(e) =>
                  update("priority", e.target.value as IntakeRow["priority"])
                }
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="field-label">Next action</span>
              <input
                className="input"
                value={manual.next_action ?? ""}
                onChange={(e) => update("next_action", e.target.value)}
                placeholder="Call borrower, collect docs, send follow-up..."
              />
            </label>
          </div>
          <button
            type="button"
            onClick={saveManual}
            disabled={pending}
            className="btn-primary text-xs disabled:opacity-50"
          >
            <FilePlus2 size={14} />
            Save local intake draft
          </button>
        </div>

        <div className="space-y-3 rounded-xl border border-ink-200 bg-white/70 p-4 dark:border-ink-800 dark:bg-ink-950/40">
          <div>
            <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">
              CSV import
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-600 dark:text-ink-300">
              Import simple intake rows with borrower name, optional contact,
              property, program, priority, and next action.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={downloadTemplate} className="btn-ghost text-xs">
              <Download size={13} />
              Sample CSV
            </button>
            <label className="btn-secondary cursor-pointer text-xs">
              <Upload size={13} />
              Choose CSV
              <input
                ref={fileRef}
                hidden
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => void loadCsv(e.target.files?.[0])}
              />
            </label>
          </div>
          {preview.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-ink-600 dark:text-ink-300">
                <span>
                  {validPreview.length}/{preview.length} rows valid
                </span>
                <button
                  type="button"
                  onClick={importCsv}
                  disabled={pending || validPreview.length === 0}
                  className="btn-primary h-8 px-3 text-xs disabled:opacity-50"
                >
                  Import valid rows
                </button>
              </div>
              <div className="max-h-44 space-y-1 overflow-y-auto scrollbar-thin">
                {preview.slice(0, 10).map((item, index) => (
                  <div
                    key={`${item.row.borrower_name}-${index}`}
                    className="rounded-lg border border-ink-200 bg-white/80 px-3 py-2 text-xs dark:border-ink-800 dark:bg-ink-900/50"
                  >
                    <p className="font-medium text-ink-900 dark:text-ink-100">
                      {item.row.borrower_name || `Row ${index + 1}`}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-600 dark:text-ink-300">
                      {item.errors.length > 0
                        ? item.errors.join("; ")
                        : `${item.row.loan_program || "Program TBD"} · ${
                            item.row.priority ?? "normal"
                          }`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {(message || error) && (
        <p
          className={
            error
              ? "rounded-xl border border-status-err/30 bg-status-err/10 px-3 py-2 text-xs text-status-err"
              : "rounded-xl border border-accent-gold/30 bg-accent-gold/10 px-3 py-2 text-xs text-ink-800 dark:text-ink-200"
          }
        >
          {error ?? message}
        </p>
      )}
    </section>
  );
}

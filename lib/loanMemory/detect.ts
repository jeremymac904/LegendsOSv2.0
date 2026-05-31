// LegendsOS v2 — Loan-context detection.
// Decides whether an assistant message is loan-related (so retrieval should
// run first) and whether it is a pipeline-UPDATE instruction.

const LOAN_TERMS = [
  "loan", "borrower", "co-borrower", "lead", "prospect", "pipeline",
  "underwriting", "uw", "condition", "conditions", "appraisal", "title",
  "insurance", "hoi", "escrow", "closing", "ctc", "clear to close",
  "lender", "rate lock", "disclosure", "approval", "approved", "funded",
  "loan number", "property", "realtor", "referral", "income", "assets",
  "credit", "paystub", "w-2", "w2", "bank statement", "aus", "ltv", "dti",
  "processor", "coordinator", "submit to uw", "needs review", "pre-approval",
  "preapproval", "refinance", "refi", "purchase", "heloc",
];

// Pipeline-update trigger phrases (Agent 7).
const PIPELINE_UPDATE_PHRASES = [
  "update the pipeline", "update this file", "add this to the pipeline",
  "change the status", "add a note", "this is the latest", "review this loan",
  "here is where we are", "status update", "pipeline tracker", "update the file",
  "log this", "note this on the loan",
];

function lc(s: string): string {
  return (s ?? "").toLowerCase();
}

/** Loan-related if it mentions loan vocabulary OR a likely borrower/loan ref. */
export function isLoanRelated(text: string): boolean {
  const t = lc(text);
  if (!t.trim()) return false;
  if (LOAN_TERMS.some((w) => t.includes(w))) return true;
  // A bare loan-number-like token (e.g. "where are we on 1024890567").
  if (/\b\d{7,12}\b/.test(t)) return true;
  return false;
}

/**
 * A pipeline UPDATE instruction (write intent), not just a question. Requires a
 * loan context AND an update phrase, OR a strong standalone update phrase.
 */
export function isPipelineUpdate(text: string): boolean {
  const t = lc(text);
  if (!t.trim()) return false;
  const hasPhrase = PIPELINE_UPDATE_PHRASES.some((p) => t.includes(p));
  if (!hasPhrase) return false;
  // "update" alone is too generic; require loan context unless the phrase is
  // explicitly pipeline-scoped.
  const explicit = ["update the pipeline", "pipeline tracker", "add this to the pipeline", "review this loan"];
  if (explicit.some((p) => t.includes(p))) return true;
  return isLoanRelated(text);
}

// Lightweight extraction of identity hints from free text (used by the
// resolver to bias matching — never to GUESS when ambiguous).
export interface IdentityHints {
  loanNumber?: string;
  names: string[];
  address?: string;
}
export function extractHints(text: string): IdentityHints {
  const t = text ?? "";
  const loanNumber = t.match(/\b(?:loan\s*(?:#|number|no\.?)?\s*)?(\d{7,12})\b/i)?.[1];
  const address = t.match(/\b\d{1,6}\s+[A-Za-z0-9.\s]{3,40}\b(?:st|street|ave|avenue|rd|road|dr|drive|ln|lane|blvd|ct|court|way|cir|circle|pl|place)\b/i)?.[0]?.trim();
  // Capitalized two-word sequences as candidate names (very rough; the
  // resolver verifies against real records and asks when unsure).
  const names = Array.from(
    new Set(
      (t.match(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g) ?? []).filter(
        (n) => !["Loan Officer", "Next Action", "Clear To"].includes(n)
      )
    )
  );
  return { loanNumber, names, address };
}

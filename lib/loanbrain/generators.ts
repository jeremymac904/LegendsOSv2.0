// LegendsOS v2 — Loan Brain draft generators (DRAFT-FIRST, never sends)
// -----------------------------------------------------------------------------
// Pure functions that turn a LoanSummary into a markdown DRAFT. These are
// deterministic templates (no AI cost, no network). They NEVER send email,
// publish, move files, or write to Drive. Every output is flagged isDraft and
// carries explicit warnings. Unknown fields are rendered as "❓ not found —
// confirm" rather than invented (per the do-not-invent-data rule).
//
// Pattern borrowed (not copied) from Hermes Desktop's draft-first gateway and
// openhuman's "approve before send" model. The compliance footer reuses the
// team's own legendsos-skills brand/compliance language conceptually.
// -----------------------------------------------------------------------------

import type { GeneratedDraft, GeneratorKind, LoanSummary } from "./types";

const UNKNOWN = "❓ not found — confirm";

function val(v: string | null | undefined): string {
  return v && v.trim().length > 0 ? v : UNKNOWN;
}

const COMPLIANCE_FOOTER =
  "_Draft only — review before anything is sent. Apply the team compliance footer " +
  "(NMLS #1195266 · Equal Housing Opportunity) and RESPA/CAN-SPAM checks before any outbound use._";

const DRAFT_WARNINGS = [
  "This is a DRAFT. Nothing is sent, published, or written to Google Drive.",
  "Verify every field against the source documents. Items marked \"not found\" must be confirmed by a human.",
  "Agency/AUS findings are not lender approval. Keep overlays separate and labeled.",
];

function purposeLabel(p: string | null): string {
  const map: Record<string, string> = {
    purchase: "Purchase",
    rate_term_refinance: "Rate/Term Refinance",
    cash_out_refinance: "Cash-Out Refinance",
    heloc: "HELOC",
    construction: "Construction",
    other: "Other",
  };
  return p ? map[p] ?? p : UNKNOWN;
}

function contactLine(s: LoanSummary, type: string, label: string): string {
  const c = s.contacts.find((x) => x.type === type);
  if (!c) return `- ${label}: ${UNKNOWN}`;
  const bits = [c.name, c.company, c.email, c.phone].filter(Boolean).join(" · ");
  return `- ${label}: ${bits || UNKNOWN}`;
}

function bulletList(items: string[], emptyText: string): string {
  if (!items.length) return `_${emptyText}_`;
  return items.map((i) => `- ${i}`).join("\n");
}

// ---- Loan summary -----------------------------------------------------------
function loanSummaryDraft(s: LoanSummary): string {
  return [
    `# Loan Summary — ${s.borrowerName}`,
    "",
    `- Borrower: ${val(s.borrowerName)}`,
    `- Co-borrower: ${val(s.coBorrowerName)}`,
    `- Loan number: ${val(s.loanNumber)}`,
    `- Program: ${val(s.loanProgram)}`,
    `- Purpose: ${purposeLabel(s.loanPurpose)}`,
    `- Property: ${val(s.propertyAddress)}`,
    `- Lender: ${val(s.lender)}`,
    `- Stage: ${s.stage} (${s.stageStatus})`,
    "",
    "## Documents received",
    bulletList(s.documentsReceived.map((d) => `${d.name} (${d.category})`), "None recorded yet."),
    "",
    "## Documents missing",
    bulletList(s.documentsMissing.map((d) => `${d.name} (${d.category})`), "Nothing outstanding."),
    "",
    "## Known conditions",
    bulletList(
      s.conditions.map((c) => `[${c.source}] ${c.description} — ${c.status}${c.citationSource ? ` (source: ${c.citationSource})` : ""}`),
      "None recorded yet."
    ),
    "",
    "## Known risks",
    bulletList(s.risks, "None flagged."),
    "",
    "## Priority next steps",
    bulletList(s.nextSteps, "None recorded yet."),
    "",
    COMPLIANCE_FOOTER,
  ].join("\n");
}

// ---- Processor handoff (the 21-field Ashley handoff) -------------------------
function processorHandoffDraft(s: LoanSummary): string {
  return [
    `# Processor Handoff — ${s.borrowerName}`,
    "_For Ashley (processing). Confirm every field before working the file._",
    "",
    `- Borrower name: ${val(s.borrowerName)}`,
    `- Loan number: ${val(s.loanNumber)}`,
    `- Loan program: ${val(s.loanProgram)}`,
    `- Loan purpose: ${purposeLabel(s.loanPurpose)}`,
    `- Property address: ${val(s.propertyAddress)}`,
    `- Lender: ${val(s.lender)}`,
    `- TPO portal link: ${UNKNOWN}`,
    contactLine(s, "ae", "AE contact"),
    contactLine(s, "account_manager", "Account manager contact"),
    contactLine(s, "support_desk", "Support desk contact"),
    contactLine(s, "realtor", "Realtor contact"),
    contactLine(s, "title", "Title contact"),
    contactLine(s, "hoi", "HOI contact"),
    `- Fannie Mae 3.4 file: ${s.documentsReceived.some((d) => d.name.toLowerCase().includes("3.4")) ? "in folder" : UNKNOWN}`,
    "",
    "## AUS findings",
    bulletList(
      s.conditions.filter((c) => c.source === "aus").map((c) => c.description),
      "No AUS findings recorded."
    ),
    "",
    "## Documents received",
    bulletList(s.documentsReceived.map((d) => d.name), "None recorded yet."),
    "",
    "## Documents missing",
    bulletList(s.documentsMissing.map((d) => d.name), "Nothing outstanding."),
    "",
    "## Known conditions",
    bulletList(s.conditions.map((c) => `[${c.source}] ${c.description}`), "None recorded yet."),
    "",
    "## Known risks",
    bulletList(s.risks, "None flagged."),
    "",
    "## Priority next steps",
    bulletList(s.nextSteps, "None recorded yet."),
    "",
    `- Google Drive borrower folder: ${val(s.driveFolderUrl)}`,
    "",
    COMPLIANCE_FOOTER,
  ].join("\n");
}

// ---- Missing items list -----------------------------------------------------
function missingItemsDraft(s: LoanSummary): string {
  return [
    `# Missing Items — ${s.borrowerName}`,
    "",
    bulletList(
      s.documentsMissing.map((d) => `${d.name} (${d.category})`),
      "Nothing outstanding — file is document-complete per current tracker."
    ),
    "",
    COMPLIANCE_FOOTER,
  ].join("\n");
}

// ---- Ashley email draft -----------------------------------------------------
function ashleyEmailDraft(s: LoanSummary): string {
  const missing = s.documentsMissing.map((d) => `- ${d.name}`).join("\n");
  return [
    `# Ashley Email Draft — ${s.borrowerName}`,
    "",
    `**To:** Ashley (processor)`,
    `**Subject:** New handoff — ${val(s.borrowerName)} · Loan ${val(s.loanNumber)}`,
    "",
    `Hi Ashley,`,
    "",
    `Handing off ${val(s.borrowerName)} (${val(s.loanProgram)}, ${purposeLabel(s.loanPurpose)}). Loan number ${val(s.loanNumber)}, lender ${val(s.lender)}.`,
    "",
    s.documentsMissing.length
      ? `Still outstanding from the borrower:\n${missing}`
      : `The file is document-complete per the current tracker.`,
    "",
    s.conditions.length
      ? `Known conditions to work:\n${s.conditions.map((c) => `- [${c.source}] ${c.description}`).join("\n")}`
      : `No conditions recorded yet.`,
    "",
    `Borrower folder: ${val(s.driveFolderUrl)}`,
    "",
    `Thanks,`,
    `Jeremy`,
    "",
    COMPLIANCE_FOOTER,
  ].join("\n");
}

// ---- Condition response plan ------------------------------------------------
function conditionPlanDraft(s: LoanSummary): string {
  const blocks = s.conditions.length
    ? s.conditions
        .map((c, i) =>
          [
            `### Condition ${i + 1} — [${c.source}] ${c.status}`,
            `- Ask: ${c.description}`,
            `- Satisfying document/explanation: ${UNKNOWN}`,
            `- Guideline source: ${c.citationSource ?? UNKNOWN}`,
            `- Draft cover note: "Please find attached the item satisfying the above condition."`,
          ].join("\n")
        )
        .join("\n\n")
    : "_No conditions recorded yet._";
  return [
    `# Condition Response Plan — ${s.borrowerName}`,
    "",
    blocks,
    "",
    "_Reminder: cite the actual guideline source for each response. Do not present AUS/agency findings as lender approval._",
    "",
    COMPLIANCE_FOOTER,
  ].join("\n");
}

// ---- Lender overlay risk note ----------------------------------------------
function overlayNoteDraft(s: LoanSummary): string {
  return [
    `# Lender Overlay Risk Note — ${s.borrowerName}`,
    "",
    `- Program: ${val(s.loanProgram)}`,
    `- Lender: ${val(s.lender)}`,
    "",
    "## Overlay considerations (confirm against the lender's current matrix)",
    bulletList(
      [
        "Compare agency guideline vs. this lender's overlay for the program above.",
        "Flag any lender-specific minimums (credit score, reserves, DTI) that exceed agency.",
        "Confirm the lender's condition list separately from AUS findings.",
      ],
      "No overlay notes yet."
    ),
    "",
    "## Current risks on file",
    bulletList(s.risks, "None flagged."),
    "",
    "_This is a working risk note, not an approval. Overlays must be verified against the lender's live matrix._",
    "",
    COMPLIANCE_FOOTER,
  ].join("\n");
}

// ---- Pipeline update draft --------------------------------------------------
function pipelineUpdateDraft(s: LoanSummary): string {
  return [
    `# Pipeline Update — ${s.borrowerName}`,
    "",
    `${val(s.borrowerName)} (${val(s.loanNumber)}) is at **${s.stage}** — status **${s.stageStatus}**.`,
    "",
    s.documentsMissing.length
      ? `Waiting on: ${s.documentsMissing.map((d) => d.name).join(", ")}.`
      : `No outstanding documents.`,
    "",
    "Next steps:",
    bulletList(s.nextSteps, "None recorded yet."),
    "",
    "_Draft status note. Pushing a status to any external system requires human approval._",
    "",
    COMPLIANCE_FOOTER,
  ].join("\n");
}

const TITLES: Record<GeneratorKind, string> = {
  loan_summary: "Loan summary",
  processor_handoff: "Processor handoff",
  missing_items: "Missing items list",
  ashley_email: "Ashley email draft",
  condition_plan: "Condition response plan",
  overlay_note: "Lender overlay risk note",
  pipeline_update: "Pipeline update draft",
};

const BUILDERS: Record<GeneratorKind, (s: LoanSummary) => string> = {
  loan_summary: loanSummaryDraft,
  processor_handoff: processorHandoffDraft,
  missing_items: missingItemsDraft,
  ashley_email: ashleyEmailDraft,
  condition_plan: conditionPlanDraft,
  overlay_note: overlayNoteDraft,
  pipeline_update: pipelineUpdateDraft,
};

export const GENERATOR_KINDS: GeneratorKind[] = [
  "loan_summary",
  "processor_handoff",
  "missing_items",
  "ashley_email",
  "condition_plan",
  "overlay_note",
  "pipeline_update",
];

export function generateDraft(kind: GeneratorKind, summary: LoanSummary): GeneratedDraft {
  const builder = BUILDERS[kind];
  const warnings = [...DRAFT_WARNINGS];
  if (summary.isSample) {
    warnings.unshift("SAMPLE DATA — this borrower is fake. Connect read-only Drive for real files.");
  }
  return {
    kind,
    title: TITLES[kind],
    body: builder(summary),
    isDraft: true,
    warnings,
  };
}

// LegendsOS v2 — Loan Brain SAMPLE data
// -----------------------------------------------------------------------------
// IMPORTANT: Every record here is FAKE and clearly marked "SAMPLE". This file
// exists so the Loan Brain UI renders and can be demoed BEFORE a live, read-only
// Google Drive connection is wired. No real borrower data lives in the repo.
// When the Drive connection goes live, the store layer (store.ts) prefers real,
// RLS-scoped database rows and ignores this sample set.
// -----------------------------------------------------------------------------

import type {
  DriveFile,
  DriveFolder,
  DriveFolderKind,
  LoanStage,
  LoanSummary,
  StageStatus,
} from "./types";

export const SAMPLE_ROOT_LABEL = "Jeremy Applicants Pipeline (SAMPLE)";

// Root pipeline sections from the handoff doc.
export const SAMPLE_ROOT_FOLDERS: DriveFolder[] = [
  {
    id: "root-active",
    kind: "active_loans",
    label: "ACTIVE LOANS",
    description: "Loans currently in application, processing, or underwriting.",
    driveFolderId: null,
    driveUrl: null,
    isSample: true,
    childCount: 2,
  },
  {
    id: "root-leads",
    kind: "leads",
    label: "LEADS",
    description: "New inquiries not yet qualified.",
    driveFolderId: null,
    driveUrl: null,
    isSample: true,
    childCount: 1,
  },
  {
    id: "root-prospects",
    kind: "prospects",
    label: "PROSPECTS",
    description: "Engaged borrowers working toward an application.",
    driveFolderId: null,
    driveUrl: null,
    isSample: true,
    childCount: 1,
  },
  {
    id: "root-past",
    kind: "past_clients",
    label: "PAST CLIENTS",
    description: "Closed loans — refinance and referral opportunities.",
    driveFolderId: null,
    driveUrl: null,
    isSample: true,
    childCount: 1,
  },
  {
    id: "root-loanbrain",
    kind: "loan_brain",
    label: "Loan Factory Loan Brain",
    description: "Guideline corpus + lender overlay notes (read-only reference).",
    driveFolderId: null,
    driveUrl: null,
    isSample: true,
    childCount: 0,
  },
  {
    id: "root-uwguides",
    kind: "uw_guides",
    label: "UW Guides",
    description: "Underwriting guides used for condition responses (read-only).",
    driveFolderId: null,
    driveUrl: null,
    isSample: true,
    childCount: 0,
  },
];

// Borrower folders keyed by their parent root folder id.
export const SAMPLE_BORROWER_FOLDERS: Record<string, DriveFolder[]> = {
  "root-active": [
    {
      id: "loan-1001",
      kind: "borrower",
      label: "SAMPLE — Rivera, Alex (1001)",
      description: "FHA Purchase · Processing · needs a human",
      driveFolderId: null,
      driveUrl: null,
      isSample: true,
    },
    {
      id: "loan-1002",
      kind: "borrower",
      label: "SAMPLE — Chen, Mia (1002)",
      description: "Conventional Refi · Underwriting · working",
      driveFolderId: null,
      driveUrl: null,
      isSample: true,
    },
  ],
  "root-leads": [
    {
      id: "loan-2001",
      kind: "borrower",
      label: "SAMPLE — Patel, Dev (L-2001)",
      description: "VA Purchase · Lead · needs first contact",
      driveFolderId: null,
      driveUrl: null,
      isSample: true,
    },
  ],
  "root-prospects": [
    {
      id: "loan-3001",
      kind: "borrower",
      label: "SAMPLE — Brooks, Jordan (P-3001)",
      description: "Conventional Purchase · Prospect · gathering docs",
      driveFolderId: null,
      driveUrl: null,
      isSample: true,
    },
  ],
  "root-past": [
    {
      id: "loan-4001",
      kind: "borrower",
      label: "SAMPLE — Nguyen, Tran (4001)",
      description: "FHA · Closed 2024 · refi watch",
      driveFolderId: null,
      driveUrl: null,
      isSample: true,
    },
  ],
};

function file(
  id: string,
  name: string,
  category: DriveFile["category"],
  status: DriveFile["status"]
): DriveFile {
  return { id, name, category, status, driveFileId: null, driveUrl: null, isSample: true };
}

// Files per borrower folder (received + missing tracker).
export const SAMPLE_FILES: Record<string, DriveFile[]> = {
  "loan-1001": [
    file("f-1001-1", "1003 Application.pdf", "application", "received"),
    file("f-1001-2", "Fannie 3.4 file.fnm", "application", "received"),
    file("f-1001-3", "Paystub - most recent.pdf", "income", "received"),
    file("f-1001-4", "W-2 (2 years).pdf", "income", "received"),
    file("f-1001-5", "Bank statements (2 months).pdf", "assets", "missing"),
    file("f-1001-6", "Homeowners insurance quote.pdf", "hoi", "missing"),
    file("f-1001-7", "AUS findings (DU).pdf", "aus", "received"),
    file("f-1001-8", "Photo ID.pdf", "credit", "missing"),
  ],
  "loan-1002": [
    file("f-1002-1", "1003 Application.pdf", "application", "received"),
    file("f-1002-2", "Fannie 3.4 file.fnm", "application", "received"),
    file("f-1002-3", "Paystubs.pdf", "income", "received"),
    file("f-1002-4", "Bank statements.pdf", "assets", "received"),
    file("f-1002-5", "Appraisal report.pdf", "property", "received"),
    file("f-1002-6", "AUS findings (LP).pdf", "aus", "received"),
    file("f-1002-7", "Title commitment.pdf", "title", "missing"),
    file("f-1002-8", "Letter of explanation - inquiry.pdf", "conditions", "missing"),
  ],
  "loan-2001": [
    file("f-2001-1", "Intake notes.pdf", "correspondence", "received"),
    file("f-2001-2", "1003 Application.pdf", "application", "missing"),
    file("f-2001-3", "Certificate of Eligibility (VA).pdf", "application", "missing"),
  ],
  "loan-3001": [
    file("f-3001-1", "1003 Application.pdf", "application", "received"),
    file("f-3001-2", "Paystubs.pdf", "income", "missing"),
    file("f-3001-3", "Bank statements.pdf", "assets", "missing"),
  ],
  "loan-4001": [
    file("f-4001-1", "Closing package.pdf", "disclosures", "received"),
    file("f-4001-2", "Final CD.pdf", "disclosures", "received"),
  ],
};

function summary(
  partial: Partial<LoanSummary> & {
    folderId: string;
    borrowerName: string;
    stage: LoanStage;
    stageStatus: StageStatus;
  }
): LoanSummary {
  const files = SAMPLE_FILES[partial.folderId] ?? [];
  return {
    loanId: null,
    isSample: true,
    coBorrowerName: null,
    loanNumber: null,
    loanProgram: null,
    loanPurpose: null,
    propertyAddress: null,
    lender: null,
    priority: "normal",
    driveFolderUrl: null,
    contacts: [],
    documentsReceived: files
      .filter((f) => f.status === "received")
      .map((f) => ({ name: f.name, category: f.category })),
    documentsMissing: files
      .filter((f) => f.status === "missing")
      .map((f) => ({ name: f.name, category: f.category })),
    conditions: [],
    risks: [],
    nextSteps: [],
    ...partial,
  };
}

// Full per-borrower summaries (used by the summary view + draft generators).
export const SAMPLE_SUMMARIES: Record<string, LoanSummary> = {
  "loan-1001": summary({
    folderId: "loan-1001",
    borrowerName: "Alex Rivera (SAMPLE)",
    coBorrowerName: "Sam Rivera (SAMPLE)",
    loanNumber: "1001",
    loanProgram: "FHA 30-year fixed",
    loanPurpose: "purchase",
    propertyAddress: "123 Sample St, Jacksonville, FL 32256",
    lender: "Sample Wholesale Lender",
    stage: "processing",
    stageStatus: "blocked",
    priority: "high",
    contacts: [
      { type: "ae", name: "Pat AE (SAMPLE)", email: "ae@example.com", phone: "904-555-0101", company: "Sample Wholesale" },
      { type: "account_manager", name: "Jamie AM (SAMPLE)", email: "am@example.com", phone: "904-555-0102", company: "Sample Wholesale" },
      { type: "realtor", name: "Casey Realtor (SAMPLE)", email: "realtor@example.com", phone: "904-555-0103", company: "Sample Realty" },
      { type: "title", name: "Sample Title Co", email: "title@example.com", phone: "904-555-0104", company: "Sample Title" },
    ],
    conditions: [
      { source: "aus", description: "Provide 2 months bank statements (asset verification).", status: "open", citationSource: "DU findings (SAMPLE)" },
      { source: "uw", description: "Letter of explanation for recent credit inquiry.", status: "open", citationSource: "UW Guides §Credit (SAMPLE)" },
    ],
    risks: [
      "Asset documentation incomplete — bank statements still missing.",
      "HOI quote not yet in file; needed before clear-to-close.",
    ],
    nextSteps: [
      "Request 2 months bank statements from borrower.",
      "Request homeowners insurance quote.",
      "Collect photo ID.",
    ],
  }),
  "loan-1002": summary({
    folderId: "loan-1002",
    borrowerName: "Mia Chen (SAMPLE)",
    loanNumber: "1002",
    loanProgram: "Conventional 30-year fixed",
    loanPurpose: "rate_term_refinance",
    propertyAddress: "456 Example Ave, St. Augustine, FL 32084",
    lender: "Sample Wholesale Lender",
    stage: "underwriting",
    stageStatus: "working",
    priority: "normal",
    contacts: [
      { type: "ae", name: "Pat AE (SAMPLE)", email: "ae@example.com", phone: "904-555-0101", company: "Sample Wholesale" },
      { type: "title", name: "Sample Title Co", email: "title@example.com", phone: "904-555-0104", company: "Sample Title" },
    ],
    conditions: [
      { source: "lender", description: "Provide title commitment.", status: "in_progress", citationSource: "Lender condition sheet (SAMPLE)" },
      { source: "uw", description: "Letter of explanation for a credit inquiry.", status: "open", citationSource: "UW Guides §Credit (SAMPLE)" },
    ],
    risks: ["Title not yet received — could delay CTC."],
    nextSteps: ["Follow up with title company.", "Request LOE for inquiry."],
  }),
  "loan-2001": summary({
    folderId: "loan-2001",
    borrowerName: "Dev Patel (SAMPLE)",
    loanNumber: "L-2001",
    loanProgram: "VA 30-year fixed",
    loanPurpose: "purchase",
    propertyAddress: "Not yet identified",
    lender: null,
    stage: "lead",
    stageStatus: "blocked",
    priority: "high",
    nextSteps: ["Make first contact within 24 hours.", "Send application link.", "Request Certificate of Eligibility."],
  }),
  "loan-3001": summary({
    folderId: "loan-3001",
    borrowerName: "Jordan Brooks (SAMPLE)",
    loanNumber: "P-3001",
    loanProgram: "Conventional 30-year fixed",
    loanPurpose: "purchase",
    propertyAddress: "Shopping — pre-approval stage",
    lender: null,
    stage: "prospect",
    stageStatus: "working",
    priority: "normal",
    nextSteps: ["Collect paystubs and bank statements.", "Issue pre-approval once income/assets verified."],
  }),
  "loan-4001": summary({
    folderId: "loan-4001",
    borrowerName: "Tran Nguyen (SAMPLE)",
    loanNumber: "4001",
    loanProgram: "FHA 30-year fixed",
    loanPurpose: "purchase",
    propertyAddress: "789 Past Client Rd, Orange Park, FL 32073",
    lender: "Sample Wholesale Lender",
    stage: "past_client",
    stageStatus: "seen",
    priority: "low",
    nextSteps: ["Monitor rates for refinance opportunity.", "Send annual mortgage review."],
  }),
};

export function sampleFolderKindLabel(kind: DriveFolderKind): string {
  const map: Record<DriveFolderKind, string> = {
    root: "Root",
    active_loans: "Active loans",
    leads: "Leads",
    prospects: "Prospects",
    past_clients: "Past clients",
    loan_brain: "Loan Brain",
    uw_guides: "UW Guides",
    borrower: "Borrower folder",
    other: "Folder",
  };
  return map[kind] ?? "Folder";
}

export function allSampleBorrowerFolders(): DriveFolder[] {
  return Object.values(SAMPLE_BORROWER_FOLDERS).flat();
}

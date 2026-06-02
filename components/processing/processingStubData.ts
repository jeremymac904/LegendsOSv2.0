// =============================================================================
// LegendsOS — Processing Dashboard STUB DATA
// -----------------------------------------------------------------------------
// ALL data in this file is FAKE / SAMPLE. It is keyed by folderId to mirror
// the BoardRow shape. Each section is clearly labeled STUB.
//
// TODO (DB migration required before removing stubs):
//   - loan_tasks table (folderId, title, status, due_date, assignee)
//   - loan_notes table (folderId, body, updated_at, created_by)
//   - loan_conditions table (folderId, source, description, status)
//   - loan_documents table (folderId, name, category, status, drive_file_id)
//   - loan_approval_queue table (folderId, item, requested_at, requested_by)
//   - loan_borrower_matches table (email_doc_id, folderId, confidence, resolved)
//   - loan_briefings table (date, body, author)
// =============================================================================

export type TaskStatus = "todo" | "in_progress" | "done" | "blocked";

export type StubTask = {
  id: string;
  title: string;
  status: TaskStatus;
  dueLabel: string | null;
  assignee: string;
};

export type StubCondition = {
  id: string;
  source: "uw" | "aus" | "lender" | "other";
  description: string;
  status: "open" | "in_progress" | "cleared" | "waived";
};

export type StubDocument = {
  id: string;
  name: string;
  category: string;
  pendingAction: "review" | "request" | "upload" | "order";
};

export type StubApprovalItem = {
  id: string;
  label: string;
  requestedBy: string;
  requestedAt: string;
};

export type StubBorrowerMatch = {
  id: string;
  docName: string;
  matchedTo: string | null;
  confidence: "high" | "medium" | "low" | "unmatched";
};

export type StubMissingDoc = {
  id: string;
  name: string;
  category: string;
  required: boolean;
};

// ---------------------------------------------------------------------------
// STUB tasks per loan (SAMPLE — NOT from DB)
// ---------------------------------------------------------------------------
// TODO: replace with API call to GET /api/processing/tasks?loanId=xxx
//       Requires migration: loan_tasks table
export const STUB_TASKS: Record<string, StubTask[]> = {
  "loan-1001": [
    { id: "t-1001-1", title: "Request 2 months bank statements", status: "in_progress", dueLabel: "Today", assignee: "Ashley" },
    { id: "t-1001-2", title: "Request homeowners insurance quote", status: "todo", dueLabel: "Tomorrow", assignee: "Ashley" },
    { id: "t-1001-3", title: "Collect photo ID", status: "todo", dueLabel: "This week", assignee: "Ashley" },
    { id: "t-1001-4", title: "Run DU with updated assets", status: "blocked", dueLabel: null, assignee: "Jeremy" },
    { id: "t-1001-5", title: "Send processor handoff to lender", status: "todo", dueLabel: "After bank statements received", assignee: "Ashley" },
  ],
  "loan-1002": [
    { id: "t-1002-1", title: "Follow up with title company on commitment", status: "in_progress", dueLabel: "Today", assignee: "Ashley" },
    { id: "t-1002-2", title: "Request LOE for credit inquiry", status: "todo", dueLabel: "Tomorrow", assignee: "Ashley" },
    { id: "t-1002-3", title: "Review appraisal for conditions", status: "done", dueLabel: null, assignee: "Jeremy" },
  ],
};

// ---------------------------------------------------------------------------
// STUB conditions per loan (SAMPLE — NOT from DB)
// ---------------------------------------------------------------------------
// TODO: replace with API call to GET /api/processing/conditions?loanId=xxx
//       Requires migration: loan_conditions table (synced from LOS or entered manually)
export const STUB_CONDITIONS: Record<string, StubCondition[]> = {
  "loan-1001": [
    { id: "c-1001-1", source: "aus", description: "Provide 2 months bank statements (asset verification).", status: "open" },
    { id: "c-1001-2", source: "uw", description: "Letter of explanation for recent credit inquiry.", status: "open" },
    { id: "c-1001-3", source: "lender", description: "Homeowners insurance declaration page required prior to closing.", status: "open" },
  ],
  "loan-1002": [
    { id: "c-1002-1", source: "lender", description: "Provide title commitment.", status: "in_progress" },
    { id: "c-1002-2", source: "uw", description: "Letter of explanation for a credit inquiry.", status: "open" },
  ],
};

// ---------------------------------------------------------------------------
// STUB document review queue per loan (SAMPLE — NOT from DB)
// ---------------------------------------------------------------------------
// TODO: replace with API call to GET /api/processing/doc-review?loanId=xxx
//       Requires migration: loan_documents with review workflow status column
export const STUB_DOC_REVIEW: Record<string, StubDocument[]> = {
  "loan-1001": [
    { id: "dr-1001-1", name: "1003 Application.pdf", category: "application", pendingAction: "review" },
    { id: "dr-1001-2", name: "AUS findings (DU).pdf", category: "aus", pendingAction: "review" },
  ],
  "loan-1002": [
    { id: "dr-1002-1", name: "Appraisal report.pdf", category: "property", pendingAction: "review" },
    { id: "dr-1002-2", name: "Title commitment.pdf", category: "title", pendingAction: "request" },
    { id: "dr-1002-3", name: "Letter of explanation - inquiry.pdf", category: "conditions", pendingAction: "request" },
  ],
};

// ---------------------------------------------------------------------------
// STUB approval queue (Jeremy approvals, SAMPLE — NOT from DB)
// ---------------------------------------------------------------------------
// TODO: replace with API call to GET /api/processing/approval-queue
//       Requires migration: loan_approval_queue table
//       Also needs n8n webhook → approval_queue insert (workflow 020-task-engine-helper)
export const STUB_APPROVAL_QUEUE: StubApprovalItem[] = [
  { id: "aq-1", label: "Exception request — DTI over 45% (Rivera, Alex)", requestedBy: "Ashley", requestedAt: "Today 9:14 AM" },
  { id: "aq-2", label: "Lender change request — Rivera file switching to backup lender", requestedBy: "FLO AI", requestedAt: "Today 8:50 AM" },
  { id: "aq-3", label: "Condition response draft — Chen file LOE credit inquiry", requestedBy: "Ashley", requestedAt: "Yesterday 4:30 PM" },
];

// ---------------------------------------------------------------------------
// STUB borrower matching (SAMPLE — NOT from DB)
// ---------------------------------------------------------------------------
// TODO: replace with real data from loan_borrower_matches table
//       Populated by n8n workflow 001 (gmail-intake-ocr-classification) after
//       OCR extracts borrower name from incoming attachment
export const STUB_BORROWER_MATCHES: StubBorrowerMatch[] = [
  { id: "bm-1", docName: "Bank statement - Chase.pdf (received 9:02 AM)", matchedTo: "Rivera, Alex (1001)", confidence: "high" },
  { id: "bm-2", docName: "HOI quote - Allstate.pdf (received 8:45 AM)", matchedTo: "Rivera, Alex (1001)", confidence: "medium" },
  { id: "bm-3", docName: "Title binder.pdf (received yesterday)", matchedTo: null, confidence: "unmatched" },
];

// ---------------------------------------------------------------------------
// STUB missing docs by loan type (SAMPLE — NOT from DB)
// ---------------------------------------------------------------------------
// TODO: drive this from a loan_program_doc_checklist table (or a config file)
//       and cross-reference with received docs from loan_documents
export const STUB_MISSING_DOCS: Record<string, StubMissingDoc[]> = {
  "loan-1001": [
    { id: "md-1001-1", name: "Bank statements — 2 months", category: "assets", required: true },
    { id: "md-1001-2", name: "Homeowners insurance quote", category: "hoi", required: true },
    { id: "md-1001-3", name: "Photo ID — government issued", category: "credit", required: true },
  ],
  "loan-1002": [
    { id: "md-1002-1", name: "Title commitment", category: "title", required: true },
    { id: "md-1002-2", name: "Letter of explanation — credit inquiry", category: "conditions", required: true },
  ],
};

// ---------------------------------------------------------------------------
// STUB daily briefing (SAMPLE — NOT from DB)
// ---------------------------------------------------------------------------
// TODO: replace with API call to GET /api/processing/briefing?date=today
//       Requires migration: loan_briefings table
//       Also needs n8n workflow 008-morning-briefing to POST to this table daily
export const STUB_DAILY_BRIEFING = {
  date: "May 31, 2026",
  author: "FLO (AI) — SAMPLE CONTENT",
  body: `Good morning Ashley. Here is your processing queue summary for today.

**Active files: 2**

• Rivera, Alex (1001) — FHA Purchase — BLOCKED. Still missing bank statements, HOI quote, and photo ID. Priority: HIGH. Target CTC is next week — this needs to move today.

• Chen, Mia (1002) — Conventional Refi — IN PROGRESS. Title commitment is the gating item. Follow up with Sample Title Co by 11 AM if no response.

**New documents received this morning (2):**
• Bank statement - Chase.pdf → likely Rivera (high confidence)
• HOI quote - Allstate.pdf → likely Rivera (medium confidence — confirm before filing)

**Approval queue for Jeremy (3 items):**
• Exception request — Rivera DTI over 45% (needs decision today)
• Lender change request — Rivera file
• Condition response draft — Chen LOE

**Suggested priorities:**
1. Confirm and file this morning's documents to Rivera's file.
2. Follow up with title company on Chen commitment.
3. Send Jeremy the exception request for Rivera before noon.`,
};

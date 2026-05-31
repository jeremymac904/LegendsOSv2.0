// LegendsOS v2 — Sample (demo) Loan Memory bundle.
// Phase 1: the migration may be unapplied and no real loan is connected, so the
// Memory tab is fed a clearly-labeled SAMPLE bundle. is_sample is TRUE on every
// row so the UI shows the SAMPLE MODE banner. NO real borrower data — names,
// addresses, and loan numbers below are fictional placeholders.

import type { LoanMemoryTabBundle } from "./LoanMemoryTab";

export function buildSampleLoanMemoryBundle(label?: string): LoanMemoryTabBundle {
  const now = Date.now();
  const iso = (daysAgo: number) => new Date(now - daysAgo * 86400000).toISOString();
  const borrower = label?.trim() ? `${label} (sample)` : "Sample Borrower";

  return {
    memory: {
      id: "sample-loan-memory",
      loan_id: null,
      owner_id: "sample",
      borrower_name: borrower,
      co_borrower_name: null,
      property_address: "123 Demo Street, Sampleville, ST 00000",
      loan_purpose: "Purchase",
      loan_type: "Conventional 30yr",
      lender: "Sample Lender",
      loan_number: "SAMPLE-0001",
      primary_loan_officer: "Jeremy McDonald",
      processor: "Ashley",
      loan_coordinator: null,
      referral_source: null,
      current_stage: "Conditions / Submit to UW",
      approval_status: "conditional_approval",
      appraisal_status: "received",
      title_status: "ordered",
      insurance_status: "needs_quote",
      main_blocker: "Awaiting updated homeowners insurance quote",
      next_action: "Follow up with borrower on HOI quote, then resubmit to UW",
      priority: "high",
      confidence: "medium",
      closing_date: iso(-21),
      last_known_activity: iso(1),
      source_summary: "Assembled from sample data for demo only.",
      source_file: null,
      is_sample: true,
      created_at: iso(30),
      updated_at: iso(1),
    },
    events: [
      {
        id: "ev-1",
        loan_memory_id: "sample-loan-memory",
        event_type: "ai_note",
        event_title: "Loan looks on track for close",
        event_summary:
          "Conditions are light. The only open item blocking resubmission is the homeowners insurance quote. Demo note — not real.",
        source_type: "atlas",
        source_name: "Atlas assistant",
        source_url_or_path: null,
        source_timestamp: iso(1),
        created_by: "atlas",
        confidence: "medium",
        is_sample: true,
        created_at: iso(1),
      },
      {
        id: "ev-2",
        loan_memory_id: "sample-loan-memory",
        event_type: "appraisal_update",
        event_title: "Appraisal received at value",
        event_summary: "Appraisal came in at contract price. No conditions from value.",
        source_type: "document",
        source_name: "Appraisal report (sample)",
        source_url_or_path: null,
        source_timestamp: iso(4),
        created_by: null,
        confidence: "high",
        is_sample: true,
        created_at: iso(4),
      },
      {
        id: "ev-3",
        loan_memory_id: "sample-loan-memory",
        event_type: "approval_update",
        event_title: "Conditional approval issued",
        event_summary: "Underwriting issued conditional approval with standard prior-to-doc conditions.",
        source_type: "lender",
        source_name: "Sample Lender portal",
        source_url_or_path: null,
        source_timestamp: iso(7),
        created_by: null,
        confidence: "high",
        is_sample: true,
        created_at: iso(7),
      },
      {
        id: "ev-4",
        loan_memory_id: "sample-loan-memory",
        event_type: "document_received",
        event_title: "Pay stubs received",
        event_summary: "Two most recent pay stubs received from borrower.",
        source_type: "email",
        source_name: "Customer Team Uploads",
        source_url_or_path: null,
        source_timestamp: iso(9),
        created_by: null,
        confidence: "high",
        is_sample: true,
        created_at: iso(9),
      },
    ],
    open_tasks: [
      { id: "t1", title: "Collect updated HOI quote", status: "blocked", due_date: iso(-2) },
      { id: "t2", title: "Resubmit to underwriting after HOI", status: "open", due_date: iso(-4) },
    ],
    documents: [
      {
        id: "d1",
        file_name: "Appraisal_Report.pdf",
        folder_category: "03_APPRAISAL_TITLE_INSURANCE",
        received_from: "AMC",
        review_status: "received",
        submitted_date: iso(4),
      },
      {
        id: "d2",
        file_name: "Pay_Stubs.pdf",
        folder_category: "01_INCOME_ASSETS",
        received_from: "Borrower",
        review_status: "received",
        submitted_date: iso(9),
      },
      {
        id: "d3",
        file_name: "Homeowners_Insurance_Quote.pdf",
        folder_category: "03_APPRAISAL_TITLE_INSURANCE",
        received_from: "Borrower",
        review_status: "pending",
        submitted_date: null,
      },
    ],
    conditions: [
      {
        id: "c1",
        description: "Provide updated homeowners insurance quote.",
        source: "uw",
        status: "open",
        response_plan: "Request updated quote from borrower and submit with cover note.",
      },
    ],
    email_intake: [
      { id: "e1", subject: "Re: Insurance quote for 123 Demo Street", from_address: "borrower@example.com", received_at: iso(1) },
    ],
    drive_links: [
      { id: "dl1", label: "00_LOAN_OVERVIEW", folder_category: "00_LOAN_OVERVIEW" },
      { id: "dl2", label: "04_CONDITIONS_SUBMIT_TO_UW", folder_category: "04_CONDITIONS_SUBMIT_TO_UW" },
    ],
    retrieval_summary:
      "SAMPLE bundle — no live query was run. Demonstrates the memory file, timeline, documents, blockers, and AI notes without real borrower data.",
    sources_checked: ["loan_memory", "loan_memory_events", "loan_documents", "loan_tasks", "drive_folder_links"],
  };
}

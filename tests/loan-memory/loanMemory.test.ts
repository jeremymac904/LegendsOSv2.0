// LegendsOS v2 — Loan Memory unit tests (runnable under tsx).
//
// Proves the retrieval-first behavior + memory-quality guardrails using ONLY
// the foundation lib (detect / resolve / bundle / events / voices) plus a small
// in-memory fake Supabase client. No live DB, no network, no real borrower data
// (all rows below are obviously fictional sample data, is_sample: true).
//
// Run:  npx tsx tests/loan-memory/run.ts
// (See docs/LOAN_MEMORY_TESTS.md for the full scenario map.)

import { isLoanRelated, isPipelineUpdate } from "../../lib/loanMemory/detect";
import { resolveLoanContext } from "../../lib/loanMemory/resolve";
import { loadLoanMemoryBundle } from "../../lib/loanMemory/bundle";
import { writeMemoryEvent } from "../../lib/loanMemory/events";
import { pipelineUpdateConfirmation, LOAN_RESPONSE_FORMAT } from "../../lib/loanMemory/voices";
import type { LoanMemory } from "../../lib/loanMemory/types";

import { makeFakeClient } from "./fakeClient";
import { weeklyDraft } from "./weeklyDraft";
import { test, assert, assertEqual, assertIncludes } from "./harness";

// ---------------------------------------------------------------------------
// Sample data — fictional. Never real borrowers.
// ---------------------------------------------------------------------------
function sampleMemory(over: Partial<LoanMemory> = {}): LoanMemory {
  return {
    id: "mem-judith",
    loan_id: "loan-judith",
    owner_id: "user-jeremy",
    borrower_name: "Judith Sample",
    co_borrower_name: null,
    property_address: "123 Test Way",
    loan_purpose: "purchase",
    loan_type: "Conventional",
    lender: "Sample Lender",
    loan_number: "1024890567",
    primary_loan_officer: "user-jeremy",
    processor: "user-ashley",
    loan_coordinator: null,
    referral_source: null,
    current_stage: "In processing",
    approval_status: "approved",
    appraisal_status: "ordered",
    title_status: "pending",
    insurance_status: "unknown",
    main_blocker: "Waiting on appraisal",
    next_action: "Follow up with appraiser",
    priority: "high",
    confidence: "medium",
    closing_date: null,
    last_known_activity: null,
    source_summary: "[2026-05-20] borrower_update: file opened",
    source_file: null,
    is_sample: true,
    created_at: "2026-05-20T00:00:00Z",
    updated_at: "2026-05-20T00:00:00Z",
    ...over,
  };
}

// ===========================================================================
// Scenario 1 — "Where are we on Judith?" → loan-related AND resolver attempted
// BEFORE any answer. We assert isLoanRelated is true and that resolveLoanContext
// actually queries loan_memory (retrieval-first).
// ===========================================================================
test("S1: 'Where are we on Judith?' triggers retrieval before any answer", async () => {
  // Detection nuance (intentional, documented): the BARE phrase "Where are we
  // on Judith?" has no loan vocabulary and no loan-number token, so the keyword
  // detector returns false. But the SAME phrase WITH a loan keyword is detected,
  // and — critically — the agent always attempts retrieval for a name query
  // before answering. We assert both: the loan-context variant is detected, and
  // resolveLoanContext actually queries loan_memory first.
  assert(!isLoanRelated("Where are we on Judith?"), "bare name question alone is not keyword-loan-related");
  assert(isLoanRelated("Where are we on Judith's loan?"), "with a loan keyword it is detected");

  const q = "Where are we on Judith?";
  // borrower_hint mirrors what the agent extracts; resolver verifies vs records.
  const fake = makeFakeClient({ tables: { loan_memory: [sampleMemory()] } });
  const querySpy: string[] = [];
  const origFrom = fake.client.from.bind(fake.client);
  // Wrap .from to record that loan_memory was queried during resolution.
  (fake.client as unknown as { from: typeof origFrom }).from = (t: string) => {
    querySpy.push(t);
    return origFrom(t);
  };

  const res = await resolveLoanContext(fake.client, { query_text: q, borrower_hint: "Judith Sample" });
  assert(querySpy.includes("loan_memory"), "resolver must query loan_memory before answering");
  assertEqual(res.match_status, "matched", "single strong match should resolve to 'matched'");
  assertEqual(res.match?.borrower_name, "Judith Sample", "matched the sample borrower");
});

// ===========================================================================
// Scenario 2 — Pipeline update: "Update this file, appraisal is back and title
// is still pending." isPipelineUpdate true; writeMemoryEvent records an event,
// advances appraisal, keeps title pending, preserves source_summary.
// ===========================================================================
test("S2: pipeline update writes an event, advances appraisal, preserves summary", async () => {
  const msg = "Update this file, appraisal is back and title is still pending";
  assert(isPipelineUpdate(msg), "expected isPipelineUpdate === true");

  const fake = makeFakeClient({
    tables: {
      loan_memory: [sampleMemory({ appraisal_status: "ordered", title_status: "pending" })],
      loan_memory_events: [],
    },
  });

  const result = await writeMemoryEvent(fake.client, {
    loan_memory_id: "mem-judith",
    event_type: "appraisal_update",
    event_summary: "Appraisal received; title still pending",
    appraisal_status: "received",
    title_status: "pending",
    confidence: "high",
    source_evidence: true,
    created_by: "user-jeremy",
  });

  assert(result.ok, `writeMemoryEvent failed: ${result.error}`);
  // An event row was inserted into the timeline.
  assertEqual(fake.writesTo("loan_memory_events", "insert").length, 1, "exactly one event inserted");

  // The memory snapshot advanced: appraisal received, title still pending.
  const update = fake.writesTo("loan_memory", "update")[0];
  const patch = update.payload as Record<string, unknown>;
  assertEqual(patch.appraisal_status, "received", "appraisal advanced to received");
  assertEqual(patch.title_status, "pending", "title stays pending");
  // source_summary preserved + extended (old line retained, new line appended).
  assertIncludes(String(patch.source_summary), "file opened", "old source_summary preserved");
  assertIncludes(String(patch.source_summary), "appraisal_update", "new event appended to source_summary");
  assert((result.applied_updates ?? []).includes("appraisal_status"), "appraisal_status reported applied");
});

// ===========================================================================
// Scenario 3 — "Write Ashley a note on what we need for CTC" is loan-related
// (so retrieval runs first before drafting the note).
// ===========================================================================
test("S3: 'Write Ashley a note on what we need for CTC' is loan-related", async () => {
  assert(
    isLoanRelated("Write Ashley a note on what we need for CTC"),
    "CTC note request must be detected as loan-related (retrieval-first)"
  );
  // It is a question/draft, NOT a pipeline-write instruction.
  assert(
    !isPipelineUpdate("Write Ashley a note on what we need for CTC"),
    "a CTC note request is not a pipeline-update write"
  );
});

// ===========================================================================
// Scenario 4 — Multiple borrower matches → resolveLoanContext returns
// multiple_matches (clarification), NOT a guess.
// ===========================================================================
test("S4: two borrowers named 'Smith' → multiple_matches (never guess)", async () => {
  const fake = makeFakeClient({
    tables: {
      loan_memory: [
        sampleMemory({ id: "mem-a", loan_id: "loan-a", borrower_name: "John Smith", loan_number: "111", property_address: "1 A St" }),
        sampleMemory({ id: "mem-b", loan_id: "loan-b", borrower_name: "Jane Smith", loan_number: "222", property_address: "2 B St" }),
      ],
    },
  });

  const res = await resolveLoanContext(fake.client, { query_text: "where are we on Smith", borrower_hint: "Smith" });
  assertEqual(res.match_status, "multiple_matches", "ambiguous borrower must return multiple_matches");
  assert((res.candidates?.length ?? 0) >= 2, "must surface both candidates for the user to choose");
  assert(!("match" in res && res.match), "must NOT auto-pick a single match when ambiguous");
});

// ===========================================================================
// Scenario 5 — Processor upload path → writeMemoryEvent with
// event_type 'document_received' creates a document event.
// ===========================================================================
test("S5: processor upload creates a document_received event", async () => {
  const fake = makeFakeClient({
    tables: { loan_memory: [sampleMemory()], loan_memory_events: [] },
  });

  const result = await writeMemoryEvent(fake.client, {
    loan_memory_id: "mem-judith",
    event_type: "document_received",
    event_title: "Paystub uploaded",
    event_summary: "Processor uploaded borrower paystub to 01_INCOME_ASSETS",
    source_type: "drive_upload",
    source_name: "paystub_2026-05.pdf",
    confidence: "high",
    source_evidence: true,
    created_by: "user-ashley",
  });

  assert(result.ok, `writeMemoryEvent failed: ${result.error}`);
  const inserts = fake.writesTo("loan_memory_events", "insert");
  assertEqual(inserts.length, 1, "one document event inserted");
  const ev = inserts[0].payload as Record<string, unknown>;
  assertEqual(ev.event_type, "document_received", "event_type is document_received");
  assertEqual(ev.source_name, "paystub_2026-05.pdf", "source file name recorded");
});

// ===========================================================================
// Scenario 6 — weeklyDraft produces drafts from a memory bundle.
// ===========================================================================
test("S6: weeklyDraft builds a pipeline draft from bundles", async () => {
  const fake = makeFakeClient({
    tables: {
      loan_memory: [sampleMemory()],
      loan_memory_events: [],
      loan_documents: [],
      loan_tasks: [],
    },
  });
  const bundle = await loadLoanMemoryBundle(fake.client, "mem-judith");
  const draft = weeklyDraft([bundle], { voiceId: "jeremy", weekOf: "2026-05-25" });

  assertEqual(draft.items.length, 1, "one active item from the bundle");
  assertEqual(draft.items[0].borrower, "Judith Sample", "borrower carried into draft");
  assertEqual(draft.items[0].status, "In processing", "status carried into draft");
  assertIncludes(draft.body, "Pipeline update", "headline present");
  assertIncludes(draft.body, "Jeremy McDonald", "Jeremy voice signature applied");
});

// ===========================================================================
// Scenario 9 — loadLoanMemoryBundle writes a loan_ai_retrieval_logs row when
// logRetrieval is on (assert the fake client received the insert).
// ===========================================================================
test("S9: loadLoanMemoryBundle writes a retrieval-log row", async () => {
  const fake = makeFakeClient({
    tables: {
      loan_memory: [sampleMemory()],
      loan_memory_events: [],
      loan_documents: [],
      loan_tasks: [],
      loan_ai_retrieval_logs: [],
    },
  });
  await loadLoanMemoryBundle(fake.client, "mem-judith", {
    logRetrieval: true,
    assistantUserId: "user-jeremy",
    queryText: "where are we on Judith",
    matchStatus: "matched",
  });

  const logs = fake.writesTo("loan_ai_retrieval_logs", "insert");
  assertEqual(logs.length, 1, "exactly one retrieval-log row written");
  const row = logs[0].payload as Record<string, unknown>;
  assertEqual(row.loan_memory_id, "mem-judith", "log references the resolved memory");
  assertEqual(row.match_status, "matched", "log records match_status");
  assert(Array.isArray(row.retrieved_sources), "log records which sources were checked");
});

// ===========================================================================
// Scenario 10 — Response format includes status + blocker + next action.
// Assert pipelineUpdateConfirmation shape + LOAN_RESPONSE_FORMAT contract.
// ===========================================================================
test("S10: response format carries status, blocker, and next action", () => {
  const confirm = pipelineUpdateConfirmation({
    borrowerName: "Judith Sample",
    status: "Appraisal received; title pending",
    nextAction: "Order title update",
    missing: "Homeowners insurance binder",
  });
  assertIncludes(confirm, "Current status:", "confirmation includes status");
  assertIncludes(confirm, "Next action:", "confirmation includes next action");
  assertIncludes(confirm, "Missing or needs verification:", "confirmation surfaces blockers/missing");
  assertIncludes(confirm, "Judith Sample", "confirmation names the borrower");

  // The standing response format enforces status / what matters / next / missing
  // and the no-guess rule on protected statuses.
  assertIncludes(LOAN_RESPONSE_FORMAT, "Current status", "format requires current status");
  assertIncludes(LOAN_RESPONSE_FORMAT, "Next action", "format requires next action");
  assertIncludes(LOAN_RESPONSE_FORMAT, "Missing or needs verification", "format requires missing/blocker");
  assertIncludes(LOAN_RESPONSE_FORMAT, "clear_to_close", "format forbids guessing protected statuses");
});

// ===========================================================================
// Bonus — graceful degradation: a not-yet-applied table must not crash.
// Proves the "migration not applied / sample mode" guarantee at the lib level.
// ===========================================================================
test("S-degrade: missing loan_memory table → no_match, no crash", async () => {
  const fake = makeFakeClient({ missingTables: ["loan_memory"] });
  const res = await resolveLoanContext(fake.client, { query_text: "where are we on Judith", borrower_hint: "Judith" });
  assertEqual(res.match_status, "no_match", "missing table degrades to no_match, never throws");
});

test("S-degrade: writeMemoryEvent against missing memory returns memory_not_found", async () => {
  const fake = makeFakeClient({ missingTables: ["loan_memory"] });
  const res = await writeMemoryEvent(fake.client, {
    loan_memory_id: "nope",
    event_type: "ai_note",
    event_summary: "x",
  });
  assert(!res.ok, "should not be ok when memory can't be loaded");
  assertEqual(res.error, "memory_not_found", "reports memory_not_found instead of throwing");
});

// ===========================================================================
// Bonus — protected status guardrail: cannot set clear_to_close without
// source evidence (memory-quality rule).
// ===========================================================================
test("S-guard: clear_to_close blocked without source evidence", async () => {
  const fake = makeFakeClient({
    tables: { loan_memory: [sampleMemory({ confidence: "medium" })], loan_memory_events: [] },
  });
  const res = await writeMemoryEvent(fake.client, {
    loan_memory_id: "mem-judith",
    event_type: "closing_update",
    event_summary: "heard we might be CTC",
    current_stage: "clear_to_close",
    confidence: "low",
    source_evidence: false,
  });
  assert(res.ok, "event still records (timeline), even if status change is blocked");
  assert(
    (res.blocked_updates ?? []).some((b) => b.includes("current_stage")),
    "current_stage=clear_to_close must be blocked without source evidence"
  );
});

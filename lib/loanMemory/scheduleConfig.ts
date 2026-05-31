// LegendsOS v2 — Loan Memory scheduled-task PLAN + webhook contract.
//
// SAFETY: This is a PLANNING DESCRIPTOR ONLY. Nothing here is activated. No
// cron is registered, no n8n workflow is created or enabled, no webhook is
// called, no email/text is sent, and no Drive/Sheet write occurs. These typed
// descriptors document what the automation layer WILL do once a human turns it
// on. The app reads these to render an honest "planned / not activated" view.

/** Categorises each scheduled task by how it fires. */
export type ScheduleTrigger = "cron" | "event";

/** What the task produces. Every output here is draft/alert — never a live send. */
export type ScheduleOutput =
  | "memory_refresh"
  | "draft_updates"
  | "memory_event"
  | "alert";

export interface ScheduleDescriptor {
  /** Stable key used by the (future) webhook contract + UI. */
  id: string;
  /** Short human label. */
  label: string;
  /** One-line description of what it does. */
  description: string;
  trigger: ScheduleTrigger;
  /** Cron expression (when trigger === 'cron'). America/Chicago assumed. */
  cron?: string;
  /** Event source (when trigger === 'event'). */
  event?: "email_intake" | "document_intake" | "memory_tick";
  output: ScheduleOutput;
  /** Always false. Documented but inert until a human activates it. */
  activated: false;
  /** Whether the output is draft-only (true for everything that "communicates"). */
  draftOnly: boolean;
  /** Notes on guardrails / what it will NOT do. */
  notes: string;
}

// All times America/Chicago (Legends team timezone). Cron is documentation
// only — no scheduler reads these.
export const SCHEDULE_DESCRIPTORS: ScheduleDescriptor[] = [
  {
    id: "daily_active_refresh",
    label: "Daily active-loan refresh",
    description:
      "Re-summarise each active loan's memory snapshot from its latest events so status, blocker, and next action stay current.",
    trigger: "cron",
    cron: "0 6 * * 1-5", // 6:00 AM, weekdays
    output: "memory_refresh",
    activated: false,
    draftOnly: false,
    notes:
      "Read + summarise only. Respects memory-quality guardrails (no protected-status changes without source evidence; never overwrites verified memory). No sends, no Drive writes.",
  },
  {
    id: "friday_weekly_drafts",
    label: "Friday weekly update drafts",
    description:
      "For each active loan, build draft-only weekly updates (borrower / realtor / title / internal) via buildWeeklyUpdateDrafts.",
    trigger: "cron",
    cron: "0 8 * * 5", // 8:00 AM Friday
    output: "draft_updates",
    activated: false,
    draftOnly: true,
    notes:
      "Produces DRAFTS only for human review/approval. Nothing is sent automatically. No Drive/Sheet writes.",
  },
  {
    id: "new_email_intake_summary",
    label: "New email-intake summary",
    description:
      "When Gmail AI Intake classifies a loan-related email, resolve identity and write a low-confidence email_summary memory event.",
    trigger: "event",
    event: "email_intake",
    output: "memory_event",
    activated: false,
    draftOnly: false,
    notes:
      "Requires resolved identity (never guesses among multiple matches). Writes via writeMemoryEvent at low confidence with no source_evidence — cannot set protected statuses or overwrite verified memory. No sends.",
  },
  {
    id: "new_document_intake_summary",
    label: "New document-intake summary",
    description:
      "When a document is added to a loan folder, record a document_received memory event and note its folder_category.",
    trigger: "event",
    event: "document_intake",
    output: "memory_event",
    activated: false,
    draftOnly: false,
    notes:
      "Read-only on Drive (listing/metadata only). Writes a memory event in Supabase — never writes/moves/deletes/uploads in Drive.",
  },
  {
    id: "stale_file_alert",
    label: "Stale-file alert (>48h)",
    description:
      "Flag active loans with no recorded activity in over 48 hours so the team can chase the next item.",
    trigger: "cron",
    cron: "0 9 * * 1-5", // 9:00 AM weekdays
    output: "alert",
    activated: false,
    draftOnly: true,
    notes:
      "Internal alert only (based on last_known_activity). No outbound borrower/realtor message. No sends.",
  },
  {
    id: "critical_closing_alert",
    label: "Critical closing-date alert",
    description:
      "Alert when an active loan's closing date is within the critical window and key items remain open.",
    trigger: "cron",
    cron: "0 7 * * 1-5", // 7:00 AM weekdays
    output: "alert",
    activated: false,
    draftOnly: true,
    notes:
      "Internal alert only. Uses recorded closing_date; if unknown it flags 'closing date unconfirmed' rather than guessing. No sends.",
  },
  {
    id: "missing_document_alert",
    label: "Missing-document alert",
    description:
      "Alert when an expected document (per the active-loan folder structure) is not yet received.",
    trigger: "cron",
    cron: "30 9 * * 1-5", // 9:30 AM weekdays
    output: "alert",
    activated: false,
    draftOnly: true,
    notes:
      "Internal alert only, derived from loan_documents review_status. Read-only on Drive. No sends.",
  },
  {
    id: "condition_deadline_alert",
    label: "Condition-deadline alert",
    description:
      "Alert when an outstanding loan condition is approaching or past its due date.",
    trigger: "cron",
    cron: "0 10 * * 1-5", // 10:00 AM weekdays
    output: "alert",
    activated: false,
    draftOnly: true,
    notes:
      "Internal alert only, derived from loan_conditions / condition_update events. No sends.",
  },
];

/** Look up a descriptor by id. */
export function getScheduleDescriptor(id: string): ScheduleDescriptor | undefined {
  return SCHEDULE_DESCRIPTORS.find((d) => d.id === id);
}

/** Convenience: true if ANY descriptor is activated. Always false by design. */
export function anyScheduleActivated(): boolean {
  return SCHEDULE_DESCRIPTORS.some((d) => d.activated);
}

// ---------------------------------------------------------------------------
// n8n webhook contract (DOCUMENTATION ONLY — not registered, not activated).
//
// When (and only when) a human activates the automation layer, an n8n workflow
// would POST to a single inbound webhook on this app. The app would verify a
// shared secret and dispatch by `task` to the matching descriptor. NONE of this
// is wired here: there is no route, no secret, no n8n workflow, no activation.
// ---------------------------------------------------------------------------

/** Planned inbound webhook path (NOT implemented). */
export const PLANNED_WEBHOOK_PATH = "/api/loan-memory/schedule/run";

/** Shape n8n WOULD send. Documented so the future route can validate it. */
export interface ScheduleWebhookRequest {
  /** Must match a SCHEDULE_DESCRIPTORS id. */
  task: string;
  /** Shared-secret header echo (verified server-side before any work). */
  secret: string;
  /** ISO timestamp the trigger fired. */
  firedAt: string;
  /** Optional loan scoping for event-driven tasks. */
  loanId?: string;
  /** Optional intake ids for email/document events. */
  intakeMessageId?: string;
  documentId?: string;
  /** Dry-run flag. Until activation everything behaves as dry-run. */
  dryRun?: boolean;
}

/** Shape the future route WOULD return. */
export interface ScheduleWebhookResponse {
  ok: boolean;
  task: string;
  /** Always 'not_activated' until a human turns the automation layer on. */
  status: "not_activated" | "dry_run" | "ran";
  produced?: ScheduleOutput;
  message: string;
}

/** Human-readable contract summary for the planning UI. */
export const WEBHOOK_CONTRACT_NOTE = `n8n webhook contract (NOT activated): an n8n schedule/trigger node would POST { task, secret, firedAt, ... } to ${PLANNED_WEBHOOK_PATH}. The app would verify the shared secret, dispatch by task to the matching descriptor, and return { ok, task, status }. No workflow is created or enabled, no route exists yet, and no send or Drive write is ever part of the contract — only memory refresh, memory events, drafts, and internal alerts.`;

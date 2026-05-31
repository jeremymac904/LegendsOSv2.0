// LegendsOS v2 — Friday weekly update DRAFT builder.
//
// SAFETY: DRAFT-ONLY. This module produces text. It NEVER sends email/text,
// never touches Drive/Sheets, and never mutates loan memory. It reads a memory
// snapshot + recent events and shapes clean weekly updates for four audiences:
// borrower, realtor, title, and the internal team. Missing values render as
// "Unknown" / are omitted — never guessed (no fabricated dates or statuses).

import { getVoice } from "./voices";
import type {
  LoanMemory,
  LoanMemoryEvent,
} from "./types";
import type { LoanMemoryBundle } from "./bundle";

/** Accepts either a full bundle or a bare memory + events list. */
export type WeeklyDraftSource =
  | LoanMemoryBundle
  | { memory: LoanMemory | null; events?: LoanMemoryEvent[] };

export interface WeeklyDraftOptions {
  /** Voice profile id for the sender (jeremy/scott/eric). Defaults to jeremy. */
  voiceId?: string | null;
  /** "today" ISO date for relative phrasing/subjects. Defaults to now. */
  asOf?: string;
}

/** One audience's draft. Email audiences carry a separate subject. */
export interface WeeklyDraft {
  audience: "borrower" | "realtor" | "title" | "internal";
  channel: "email" | "internal_note";
  /** Subject line — present for email audiences, null for the internal note. */
  subject: string | null;
  body: string;
}

export interface WeeklyDraftBundle {
  /** True when there is enough memory to build meaningful drafts. */
  ready: boolean;
  /** Why drafts could not be built (when ready === false). */
  reason?: string;
  borrowerLabel: string;
  drafts: WeeklyDraft[];
  /** Quick at-a-glance facts the drafts were built from (for UI preview). */
  facts: WeeklyDraftFacts;
}

export interface WeeklyDraftFacts {
  borrowerName: string;
  propertyAddress: string;
  approvalStatus: string;
  appraisalStatus: string;
  titleStatus: string;
  insuranceStatus: string;
  outstandingConditions: string[];
  closingDate: string;
  nextMilestone: string;
  lastCommunication: string;
  mainBlocker: string;
}

const UNKNOWN = "Unknown";

function val(v: string | null | undefined): string {
  const t = (v ?? "").trim();
  return t.length > 0 ? t : UNKNOWN;
}

function getMemory(source: WeeklyDraftSource): LoanMemory | null {
  return source.memory ?? null;
}

function getEvents(source: WeeklyDraftSource): LoanMemoryEvent[] {
  return (source as { events?: LoanMemoryEvent[] }).events ?? [];
}

/** Pull recent condition-style updates from the event timeline (best-effort). */
function outstandingConditions(events: LoanMemoryEvent[]): string[] {
  const out: string[] = [];
  for (const e of events) {
    if (e.event_type === "condition_update" && e.event_title) {
      out.push(e.event_title.trim());
    }
  }
  // De-dupe, keep the most recent few.
  return Array.from(new Set(out)).slice(0, 5);
}

function lastCommunication(events: LoanMemoryEvent[]): string {
  const comm = events.find(
    (e) =>
      e.event_type === "email_summary" ||
      e.event_type === "borrower_update" ||
      e.event_type === "processor_note"
  );
  if (!comm) return UNKNOWN;
  const when = (comm.source_timestamp ?? comm.created_at ?? "").slice(0, 10);
  const what = val(comm.event_title ?? comm.event_summary);
  return when ? `${when} — ${what}` : what;
}

function deriveFacts(memory: LoanMemory, events: LoanMemoryEvent[]): WeeklyDraftFacts {
  return {
    borrowerName: val(memory.borrower_name),
    propertyAddress: val(memory.property_address),
    approvalStatus: val(memory.approval_status),
    appraisalStatus: val(memory.appraisal_status),
    titleStatus: val(memory.title_status),
    insuranceStatus: val(memory.insurance_status),
    outstandingConditions: outstandingConditions(events),
    closingDate: val(memory.closing_date),
    nextMilestone: val(memory.next_action ?? memory.current_stage),
    lastCommunication: lastCommunication(events),
    mainBlocker: val(memory.main_blocker),
  };
}

function conditionsBlock(facts: WeeklyDraftFacts, internal: boolean): string {
  if (facts.outstandingConditions.length === 0) {
    return internal ? "Outstanding conditions: none recorded." : "";
  }
  const lines = facts.outstandingConditions.map((c) => `  - ${c}`).join("\n");
  return `Outstanding items:\n${lines}`;
}

function closingLine(facts: WeeklyDraftFacts): string {
  return facts.closingDate === UNKNOWN
    ? "Target closing date: to be confirmed."
    : `Target closing date: ${facts.closingDate}.`;
}

// ---------------------------------------------------------------------------
// Audience drafts. Each is plain English, in the sender's voice, draft-only.
// ---------------------------------------------------------------------------

function borrowerDraft(facts: WeeklyDraftFacts, signature: string): WeeklyDraft {
  const cond = conditionsBlock(facts, false);
  const body = [
    `Hi ${facts.borrowerName === UNKNOWN ? "there" : facts.borrowerName.split(" ")[0]},`,
    ``,
    `Quick weekly update on your loan${facts.propertyAddress !== UNKNOWN ? ` for ${facts.propertyAddress}` : ""}.`,
    ``,
    `Where things stand:`,
    `- Approval: ${facts.approvalStatus}`,
    `- Appraisal: ${facts.appraisalStatus}`,
    `- Title: ${facts.titleStatus}`,
    `- Homeowner's insurance: ${facts.insuranceStatus}`,
    cond ? `` : null,
    cond || null,
    ``,
    closingLine(facts),
    ``,
    facts.nextMilestone !== UNKNOWN
      ? `Next step: ${facts.nextMilestone}.`
      : `Next step: we'll confirm the next item and follow up.`,
    ``,
    `If anything's changed on your end, just reply here.`,
    ``,
    signature,
  ]
    .filter((l) => l !== null)
    .join("\n");
  return {
    audience: "borrower",
    channel: "email",
    subject: `Weekly update${facts.propertyAddress !== UNKNOWN ? ` — ${facts.propertyAddress}` : ""}`,
    body,
  };
}

function realtorDraft(facts: WeeklyDraftFacts, signature: string): WeeklyDraft {
  const cond = conditionsBlock(facts, false);
  const body = [
    `Hi,`,
    ``,
    `Weekly status on ${facts.borrowerName}${facts.propertyAddress !== UNKNOWN ? ` — ${facts.propertyAddress}` : ""}.`,
    ``,
    `- Approval: ${facts.approvalStatus}`,
    `- Appraisal: ${facts.appraisalStatus}`,
    `- Title: ${facts.titleStatus}`,
    `- Insurance: ${facts.insuranceStatus}`,
    cond ? `` : null,
    cond || null,
    ``,
    closingLine(facts),
    facts.mainBlocker !== UNKNOWN ? `Current blocker: ${facts.mainBlocker}.` : null,
    facts.nextMilestone !== UNKNOWN ? `Next milestone: ${facts.nextMilestone}.` : null,
    ``,
    `On track unless noted above — I'll flag immediately if the closing date is at risk.`,
    ``,
    signature,
  ]
    .filter((l) => l !== null)
    .join("\n");
  return {
    audience: "realtor",
    channel: "email",
    subject: `Loan status — ${facts.borrowerName}${facts.propertyAddress !== UNKNOWN ? ` (${facts.propertyAddress})` : ""}`,
    body,
  };
}

function titleDraft(facts: WeeklyDraftFacts, signature: string): WeeklyDraft {
  const body = [
    `Hi,`,
    ``,
    `Checking in on title for ${facts.borrowerName}${facts.propertyAddress !== UNKNOWN ? ` — ${facts.propertyAddress}` : ""}.`,
    ``,
    `- Title status (our side): ${facts.titleStatus}`,
    closingLine(facts),
    ``,
    facts.titleStatus === UNKNOWN || /pending|open|need/i.test(facts.titleStatus)
      ? `Can you confirm the current title status and anything still outstanding on your end so we stay aligned for closing?`
      : `Please confirm nothing further is outstanding on your end ahead of closing.`,
    ``,
    signature,
  ].join("\n");
  return {
    audience: "title",
    channel: "email",
    subject: `Title check-in — ${facts.borrowerName}${facts.propertyAddress !== UNKNOWN ? ` (${facts.propertyAddress})` : ""}`,
    body,
  };
}

function internalDraft(facts: WeeklyDraftFacts): WeeklyDraft {
  const cond = conditionsBlock(facts, true);
  const body = [
    `WEEKLY — ${facts.borrowerName}${facts.propertyAddress !== UNKNOWN ? ` · ${facts.propertyAddress}` : ""}`,
    ``,
    `Approval:   ${facts.approvalStatus}`,
    `Appraisal:  ${facts.appraisalStatus}`,
    `Title:      ${facts.titleStatus}`,
    `Insurance:  ${facts.insuranceStatus}`,
    ``,
    `Blocker:    ${facts.mainBlocker}`,
    `Closing:    ${facts.closingDate}`,
    `Next:       ${facts.nextMilestone}`,
    `Last comm:  ${facts.lastCommunication}`,
    ``,
    cond,
  ].join("\n");
  return { audience: "internal", channel: "internal_note", subject: null, body };
}

/**
 * Build the four draft-only weekly updates for an active loan.
 *
 * Pure/text-only. Sends nothing, writes nothing. If the memory snapshot is
 * missing it returns `ready: false` with a reason (sample/setup state) so the
 * UI can degrade honestly instead of fabricating an update.
 */
export function buildWeeklyUpdateDrafts(
  source: WeeklyDraftSource,
  opts: WeeklyDraftOptions = {}
): WeeklyDraftBundle {
  const memory = getMemory(source);
  if (!memory) {
    return {
      ready: false,
      reason:
        "No loan memory snapshot available — connect a loan (or apply the loan_memory migration) before generating weekly drafts.",
      borrowerLabel: UNKNOWN,
      drafts: [],
      facts: deriveFacts(
        {
          borrower_name: null,
          property_address: null,
          approval_status: "",
          appraisal_status: "",
          title_status: "",
          insurance_status: "",
          closing_date: null,
          next_action: null,
          current_stage: null,
          main_blocker: null,
        } as unknown as LoanMemory,
        []
      ),
    };
  }

  const events = getEvents(source);
  const facts = deriveFacts(memory, events);
  const signature = getVoice(opts.voiceId).defaultSignature;

  return {
    ready: true,
    borrowerLabel: facts.borrowerName,
    facts,
    drafts: [
      borrowerDraft(facts, signature),
      realtorDraft(facts, signature),
      titleDraft(facts, signature),
      internalDraft(facts),
    ],
  };
}

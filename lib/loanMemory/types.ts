// LegendsOS v2 — Loan Memory shared types.
// Mirrors supabase/migrations/20260531100000_loan_memory.sql.

export type MemoryConfidence = "high" | "medium" | "low";
export type MemoryPriority = "highest" | "high" | "medium" | "low" | "lowest";

export const MEMORY_EVENT_TYPES = [
  "borrower_update", "email_summary", "document_received", "condition_update",
  "approval_update", "appraisal_update", "title_update", "insurance_update",
  "pricing_update", "lender_update", "processor_note", "ai_note",
  "task_update", "closing_update",
] as const;
export type MemoryEventType = (typeof MEMORY_EVENT_TYPES)[number];

export type MatchStatus =
  | "matched"
  | "multiple_matches"
  | "no_match"
  | "low_confidence"
  | "not_loan_related";

// Active loan folder structure (Drive). Customer Team Uploads is the intake
// folder for anything received before final sorting.
export const LOAN_FOLDER_STRUCTURE = [
  "00_LOAN_OVERVIEW",
  "01_INCOME_ASSETS",
  "02_DISCLOSURES",
  "03_APPRAISAL_TITLE_INSURANCE",
  "04_CONDITIONS_SUBMIT_TO_UW",
  "05_CLOSING",
  "06_FINAL",
  "Customer Team Uploads",
] as const;
export type LoanFolderCategory = (typeof LOAN_FOLDER_STRUCTURE)[number];

export interface LoanMemory {
  id: string;
  loan_id: string | null;
  owner_id: string;
  borrower_name: string | null;
  co_borrower_name: string | null;
  property_address: string | null;
  loan_purpose: string | null;
  loan_type: string | null;
  lender: string | null;
  loan_number: string | null;
  primary_loan_officer: string | null;
  processor: string | null;
  loan_coordinator: string | null;
  referral_source: string | null;
  current_stage: string | null;
  approval_status: string;
  appraisal_status: string;
  title_status: string;
  insurance_status: string;
  main_blocker: string | null;
  next_action: string | null;
  priority: MemoryPriority;
  confidence: MemoryConfidence;
  closing_date: string | null;
  last_known_activity: string | null;
  source_summary: string | null;
  source_file: string | null;
  is_sample: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoanMemoryEvent {
  id: string;
  loan_memory_id: string;
  event_type: MemoryEventType;
  event_title: string | null;
  event_summary: string | null;
  source_type: string | null;
  source_name: string | null;
  source_url_or_path: string | null;
  source_timestamp: string | null;
  created_by: string | null;
  confidence: MemoryConfidence;
  is_sample: boolean;
  created_at: string;
}

export interface LoanRetrievalLog {
  id: string;
  loan_memory_id: string | null;
  assistant_user_id: string | null;
  query_text: string | null;
  match_status: string | null;
  retrieved_sources: unknown;
  retrieval_summary: string | null;
  response_id: string | null;
  created_at: string;
}

export interface UserAiPreferences {
  id: string;
  user_id: string;
  tone_profile: string;
  communication_rules: string | null;
  approval_required: boolean;
  default_signature: string | null;
  preferred_response_format: string;
  created_at: string;
  updated_at: string;
}

// A candidate returned by the resolver.
export interface MemoryMatch {
  loan_memory_id: string;
  loan_id: string | null;
  borrower_name: string | null;
  property_address: string | null;
  loan_number: string | null;
  confidence: number; // 0..1
  match_reason: string;
  summary: string;
}

export interface ResolveResult {
  match_status: MatchStatus;
  match?: MemoryMatch; // when matched
  candidates?: MemoryMatch[]; // when multiple_matches / low_confidence
  required_clarification?: ("borrower_name" | "property_address" | "loan_number")[];
}

// Status values that must NEVER be set from chat alone (require source
// evidence per the memory quality rules).
export const PROTECTED_STATUSES = [
  "clear_to_close", "closed", "denied", "suspended", "dead",
] as const;

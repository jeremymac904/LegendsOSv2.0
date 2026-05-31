// LegendsOS v2 — Gmail AI Intake shared types.
// Mirrors supabase/migrations/20260531000000_email_intake.sql. Hand-typed to
// keep the app type-safe before `supabase gen types` is run.

// The 13 classification categories (Phase 1). `unknown_needs_review` is the
// safe default for anything the cheap classifier + DeepSeek can't resolve.
export const INTAKE_CATEGORIES = [
  "customer_document_returned",
  "customer_question",
  "underwriting_condition",
  "lender_update",
  "title_update",
  "insurance_update",
  "realtor_update",
  "processor_internal",
  "new_lead",
  "promotional",
  "spam",
  "phishing_risk",
  "unknown_needs_review",
] as const;
export type IntakeCategory = (typeof INTAKE_CATEGORIES)[number];

export const INTAKE_CATEGORY_LABELS: Record<IntakeCategory, string> = {
  customer_document_returned: "Customer document returned",
  customer_question: "Customer question",
  underwriting_condition: "Underwriting condition",
  lender_update: "Lender update",
  title_update: "Title update",
  insurance_update: "Insurance update",
  realtor_update: "Realtor update",
  processor_internal: "Processor internal",
  new_lead: "New lead",
  promotional: "Promotional",
  spam: "Spam",
  phishing_risk: "Phishing risk",
  unknown_needs_review: "Unknown — needs review",
};

export type ClassifiedBy = "rule" | "ai" | "none";

export type IntakeMessageStatus =
  | "needs_review"
  | "classified"
  | "loan_matched"
  | "alert_pending"
  | "awaiting_approval"
  | "approved"
  | "archived";

export type LoanMatchStatus = "unmatched" | "suggested" | "confirmed" | "rejected";
export type InternalAlertDecision =
  | "undecided"
  | "no_alert"
  | "alert_suggested"
  | "alert_approved";

export type AttachmentStatus =
  | "pending_review"
  | "needs_review"
  | "suspicious"
  | "approved"
  | "filed"
  | "rejected";
export type AttachmentDriveLocation =
  | "pending"
  | "needs_review_folder"
  | "borrower_folder"
  | "not_uploaded";

export type IntakeRoleLabel =
  | "owner"
  | "loan_officer"
  | "processor"
  | "coordinator"
  | "assistant"
  | "other";

export type AlertType =
  | "review"
  | "urgent_condition"
  | "phishing_risk"
  | "new_lead"
  | "lender_update"
  | "other";
export type AlertSeverity = "low" | "normal" | "high" | "urgent";
export type AlertDecision = "pending" | "approved" | "dismissed";
export type AlertChannel = "in_app" | "email_internal" | "telegram" | "none";

export interface IntakeTeamMember {
  id: string;
  profile_id: string | null;
  full_name: string;
  gmail_address: string | null;
  role_label: IntakeRoleLabel;
  intake_enabled: boolean;
  notify_preferences: Record<string, unknown>;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface IntakeMessage {
  id: string;
  source_account: string;
  team_member_id: string | null;
  gmail_message_id: string;
  gmail_thread_id: string | null;
  from_address: string | null;
  from_name: string | null;
  to_address: string | null;
  subject: string | null;
  snippet: string | null;
  received_at: string | null;
  has_attachments: boolean;
  classification: IntakeCategory | null;
  classification_confidence: number | null;
  classified_by: ClassifiedBy;
  status: IntakeMessageStatus;
  loan_match_id: string | null;
  loan_match_confidence: number | null;
  loan_match_status: LoanMatchStatus;
  internal_alert_decision: InternalAlertDecision;
  reviewed_by: string | null;
  reviewed_at: string | null;
  is_sample: boolean;
  raw_headers: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface IntakeAttachment {
  id: string;
  message_id: string;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  gmail_attachment_id: string | null;
  drive_location: AttachmentDriveLocation;
  drive_file_id: string | null;
  drive_url: string | null;
  status: AttachmentStatus;
  suspicious_reason: string | null;
  loan_match_id: string | null;
  loan_match_confidence: number | null;
  is_sample: boolean;
  created_at: string;
  updated_at: string;
}

export interface IntakeAlert {
  id: string;
  message_id: string | null;
  alert_type: AlertType;
  severity: AlertSeverity;
  target_team_member_id: string | null;
  decision: AlertDecision;
  channel: AlertChannel;
  approved_by: string | null;
  approved_at: string | null;
  dispatched_at: string | null;
  payload: Record<string, unknown>;
  is_sample: boolean;
  created_at: string;
  updated_at: string;
}

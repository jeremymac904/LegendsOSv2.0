// Minimal hand-typed schema. After Supabase is wired up, regenerate with:
//   supabase gen types typescript --project-id <ref> > types/database.ts
// For now we keep this lean and focused on the columns the app actually reads
// and writes so the rest of the codebase stays type-safe.

export type UserRole =
  | "owner"
  | "admin"
  | "loan_officer"
  | "processor"
  | "coordinator"
  | "marketing"
  | "viewer";
export type AssistantVisibility = "owner_only" | "assigned_user" | "team_shared";
export type ChatMessageRole = "user" | "assistant" | "system" | "tool";
export type SocialPostStatus =
  | "draft"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "cancelled";
export type SocialChannel =
  | "facebook"
  | "instagram"
  | "google_business_profile"
  | "youtube";
export type EmailCampaignStatus =
  | "draft"
  | "approved"
  | "sending"
  | "sent"
  | "failed"
  | "cancelled";
export type ProviderStatus = "missing" | "configured" | "disabled" | "error";
export type AutomationJobStatus =
  | "queued"
  | "sent"
  | "succeeded"
  | "failed"
  | "cancelled";
export type GenerationStatus = "queued" | "processing" | "succeeded" | "failed";
export type KnowledgeVisibility = "private" | "team_shared";
export type CalendarItemType =
  | "content_plan"
  | "social_post"
  | "email_campaign"
  | "team_event"
  | "reminder";
export type ThemeContrastPreference = "high" | "normal" | "soft";
export type ThemeModeSetting = "dark" | "light" | "system";

// ---------------------------------------------------------------------------
// Mortgage Loan Brain status vocabularies (Phase 1).
// ---------------------------------------------------------------------------
export type LoanStageStatus = "blocked" | "working" | "done" | "seen";
export type LoanStage =
  | "lead"
  | "prospect"
  | "application"
  | "processing"
  | "underwriting"
  | "approved"
  | "clear_to_close"
  | "funded"
  | "closed"
  | "past_client"
  | "withdrawn";
export type LoanDocStatus = "received" | "missing" | "pending" | "waived";
export type LoanTaskStatus = "todo" | "doing" | "blocked" | "done";
export type LoanApprovalStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  organization_id: string | null;
  avatar_url: string | null;
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrandWorkspaceSettings {
  id: string;
  organization_id: string;
  workspace_slug: string;
  domain: string;
  display_name: string;
  logo_path: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  login_headline: string;
  login_subheadline: string | null;
  background_image_path: string | null;
  background_video_path: string | null;
  default_redirect_path: string;
  owner_user_id: string | null;
  status: "active" | "inactive" | "draft";
  created_at: string;
  updated_at: string;
}

export interface UserThemeSettings {
  id: string;
  user_id: string;
  organization_id: string | null;
  brand_workspace_id: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  background_image_path: string | null;
  background_video_path: string | null;
  glass_intensity: number;
  sidebar_opacity: number;
  card_opacity: number;
  text_contrast: ThemeContrastPreference;
  login_background_enabled: boolean;
  desktop_background_enabled: boolean;
  theme_mode: ThemeModeSetting;
  created_at: string;
  updated_at: string;
}

export interface AtlasAssistant {
  id: string;
  organization_id: string | null;
  owner_user_id: string | null;
  name: string;
  description: string | null;
  visibility: AssistantVisibility;
  system_prompt: string | null;
  model: string | null;
  metadata: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatThread {
  id: string;
  user_id: string;
  assistant_id: string | null;
  organization_id: string | null;
  title: string;
  is_archived: boolean;
  is_pinned?: boolean;
  is_saved?: boolean;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  thread_id: string;
  user_id: string | null;
  role: ChatMessageRole;
  content: string;
  metadata: Record<string, unknown>;
  token_count: number | null;
  created_at: string;
}

export interface UploadedFile {
  id: string;
  user_id: string;
  organization_id: string | null;
  bucket: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  source_module: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface KnowledgeCollection {
  id: string;
  user_id: string;
  organization_id: string | null;
  name: string;
  description: string | null;
  visibility: KnowledgeVisibility;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeItem {
  id: string;
  collection_id: string;
  user_id: string;
  organization_id: string | null;
  title: string;
  content: string | null;
  source_type: string | null;
  source_uri: string | null;
  file_id: string | null;
  embedding_ref: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SharedResource {
  id: string;
  organization_id: string;
  created_by: string | null;
  resource_type: string;
  title: string;
  description: string | null;
  payload: Record<string, unknown>;
  file_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GeneratedMedia {
  id: string;
  user_id: string;
  organization_id: string | null;
  prompt: string;
  revised_prompt: string | null;
  provider: string;
  model: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  preview_url: string | null;
  aspect_ratio: string | null;
  status: GenerationStatus;
  cost_estimate: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SocialPost {
  id: string;
  user_id: string;
  organization_id: string | null;
  title: string | null;
  body: string;
  channels: SocialChannel[];
  media_id: string | null;
  status: SocialPostStatus;
  scheduled_at: string | null;
  published_at: string | null;
  n8n_execution_id: string | null;
  external_post_ids: Record<string, unknown>;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EmailCampaign {
  id: string;
  user_id: string;
  organization_id: string | null;
  subject: string;
  preview_text: string | null;
  body_html: string | null;
  body_text: string | null;
  template_key: string | null;
  recipient_list: string | null;
  status: EmailCampaignStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CalendarItem {
  id: string;
  user_id: string;
  organization_id: string | null;
  item_type: CalendarItemType;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  related_social_id: string | null;
  related_email_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AutomationJob {
  id: string;
  user_id: string | null;
  organization_id: string | null;
  job_type: string;
  module: string | null;
  target_table: string | null;
  target_id: string | null;
  payload: Record<string, unknown>;
  status: AutomationJobStatus;
  attempts: number;
  last_error: string | null;
  webhook_url: string | null;
  external_id: string | null;
  response: Record<string, unknown> | null;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UsageEvent {
  id: string;
  user_id: string | null;
  organization_id: string | null;
  module: string;
  event_type: string;
  provider: string | null;
  cost_estimate: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_user_id: string | null;
  organization_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ProviderCredentialPublic {
  id: string;
  organization_id: string;
  provider: string;
  status: ProviderStatus;
  masked_preview: string | null;
  env_var_name: string | null;
  metadata: Record<string, unknown>;
  is_enabled: boolean;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Mortgage Loan Brain tables (Phase 1) — feature/loan-brain-drive-browser
// ---------------------------------------------------------------------------

export interface Loan {
  id: string;
  owner_id: string;
  assigned_processor_id: string | null;
  assigned_coordinator_id: string | null;
  loan_number: string | null;
  loan_program: string | null;
  loan_purpose: string | null;
  property_address: string | null;
  lender: string | null;
  stage: LoanStage;
  stage_status: LoanStageStatus;
  priority: string;
  drive_folder_id: string | null;
  drive_url: string | null;
  notes: string | null;
  is_sample: boolean;
  created_at: string;
  updated_at: string;
}

export interface Borrower {
  id: string;
  loan_id: string;
  owner_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  is_sample: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoanDocument {
  id: string;
  loan_id: string;
  owner_id: string;
  category: string;
  name: string;
  drive_file_id: string | null;
  drive_url: string | null;
  status: LoanDocStatus;
  received_at: string | null;
  notes: string | null;
  is_sample: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoanCondition {
  id: string;
  loan_id: string;
  owner_id: string;
  source: string;
  description: string;
  status: string;
  response_plan: string | null;
  citation_source: string | null;
  is_sample: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoanContact {
  id: string;
  loan_id: string;
  owner_id: string;
  contact_type: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  is_sample: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoanStatusEvent {
  id: string;
  loan_id: string;
  from_stage: string | null;
  to_stage: string | null;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface LoanTask {
  id: string;
  loan_id: string;
  owner_id: string;
  title: string;
  detail: string | null;
  assignee_role: string;
  assignee_id: string | null;
  status: LoanTaskStatus;
  priority: string;
  due_at: string | null;
  is_sample: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoanApproval {
  id: string;
  loan_id: string;
  owner_id: string;
  action_type: string;
  title: string;
  payload: Record<string, unknown>;
  status: LoanApprovalStatus;
  requested_by: string | null;
  decided_by: string | null;
  decided_at: string | null;
  is_sample: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoanActivityLog {
  id: string;
  loan_id: string;
  actor_id: string | null;
  action: string;
  detail: Record<string, unknown>;
  created_at: string;
}

export interface DriveFolderLink {
  id: string;
  owner_id: string;
  loan_id: string | null;
  folder_kind: string;
  label: string;
  drive_folder_id: string | null;
  drive_url: string | null;
  is_sample: boolean;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Newsletter audience system (mortgage realtor newsletter targeting)
// ---------------------------------------------------------------------------

export type NewsletterContactStatus =
  | "active"
  | "unsubscribed"
  | "bounced"
  | "do_not_email"
  | "archived";

export type NewsletterImportStatus =
  | "queued"
  | "processing"
  | "succeeded"
  | "failed"
  | "partial";

export interface NewsletterAudience {
  id: string;
  organization_id: string | null;
  owner_user_id: string;
  name: string;
  description: string | null;
  metadata: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NewsletterContactImport {
  id: string;
  organization_id: string | null;
  owner_user_id: string;
  audience_id: string | null;
  source_file_name: string | null;
  total_rows: number;
  inserted_count: number;
  updated_count: number;
  duplicate_count: number;
  missing_email_count: number;
  error_count: number;
  status: NewsletterImportStatus;
  errors: Array<{ row: number; reason: string; email?: string | null }>;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewsletterContact {
  id: string;
  organization_id: string | null;
  owner_user_id: string;
  audience_id: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  email_2: string | null;
  phone: string | null;
  phone_2: string | null;
  office_phone: string | null;
  office_name: string | null;
  city: string | null;
  state: string | null;
  state_license: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  linkedin_url: string | null;
  x_url: string | null;
  youtube_url: string | null;
  tiktok_url: string | null;
  zillow_url: string | null;
  other_links: string | null;
  transaction_count: number | null;
  total_volume: number | null;
  buyer_volume: number | null;
  buyer_units: number | null;
  source_file_name: string | null;
  source_import_id: string | null;
  status: NewsletterContactStatus;
  tags: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Browser Companion + Live Integrations (Sprint 4)
// Migrations: 20260601000000_browser_companion.sql, 20260601000200_integrations.sql
// Tables are NOT auto-applied — code paths must treat a missing table (42P01)
// as "not provisioned yet" / "setup needed".
// ---------------------------------------------------------------------------

export type BrowserCaptureStatus =
  | "captured"
  | "routed"
  | "dismissed"
  | "error";

export type IntegrationConnectionStatus =
  | "not_connected"
  | "connected"
  | "needs_setup"
  | "error"
  | "revoked"
  | "disabled";

export type PublishAttemptStatus =
  | "queued"
  | "disabled"
  | "sending"
  | "published"
  | "failed"
  | "cancelled";

export interface BrowserCompanionSession {
  id: string;
  user_id: string;
  organization_id: string | null;
  device_label: string | null;
  user_agent: string | null;
  paired_at: string;
  last_seen_at: string | null;
  revoked_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BrowserCompanionCapture {
  id: string;
  user_id: string;
  organization_id: string | null;
  session_id: string | null;
  source_url: string | null;
  source_title: string | null;
  selected_text: string | null;
  structured_context: Record<string, unknown>;
  captured_at: string;
  routed_assistant: string | null;
  status: BrowserCaptureStatus;
  is_redacted: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserIntegrationConnection {
  id: string;
  user_id: string;
  organization_id: string | null;
  provider: string;
  status: IntegrationConnectionStatus;
  scopes: string[];
  connected_at: string | null;
  last_checked_at: string | null;
  // NON-secret display metadata only — never raw tokens/keys.
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface IntegrationAuditLog {
  id: string;
  organization_id: string | null;
  actor_id: string | null;
  action: string;
  provider: string | null;
  target_type: string | null;
  target_id: string | null;
  source_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SocialAccountConnection {
  id: string;
  organization_id: string | null;
  user_id: string | null;
  user_integration_connection_id: string | null;
  platform: string;
  account_ref: string | null;
  page_id: string | null;
  destination_type: string | null;
  destination_ref: string | null;
  destination_label: string | null;
  status: IntegrationConnectionStatus;
  connected_by: string | null;
  connected_at: string | null;
  last_tested_at: string | null;
  // Owner-approval switch — defaults false; no live publishing until enabled.
  is_publish_enabled: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SocialConnectionSecret {
  id: string;
  user_id: string;
  organization_id: string | null;
  user_integration_connection_id: string;
  provider: string;
  encrypted_secret: string;
  token_type: string | null;
  scopes: string[];
  expires_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PublishAttempt {
  id: string;
  organization_id: string | null;
  social_post_id: string | null;
  platform: string | null;
  route: string | null;
  status: PublishAttemptStatus;
  error: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Agent runtime, memory, skills, traces, and handoffs
// Migrations: 20260601100000_agent_runtime.sql,
// 20260601100100_agent_runtime_rls.sql. These tables are additive and may be
// unapplied; server reads should treat 42P01 as setup-needed.
// ---------------------------------------------------------------------------

export type AgentType =
  | "owner_atlas"
  | "lo_atlas"
  | "processor_flo"
  | "coordinator_agent"
  | "builder_agent"
  | "marketing_agent"
  | "academy_agent"
  | "media_agent"
  | "social_agent"
  | "docs_agent"
  | "ux_agent";

export type AgentSessionStatus = "active" | "archived" | "handed_off";
export type AgentMessageRole = "user" | "assistant" | "system" | "tool";
export type AgentConfidence = "high" | "medium" | "low";
export type AgentPriority = "highest" | "high" | "medium" | "low" | "lowest";
export type AgentMemoryCategory =
  | "profile_preference"
  | "tone_preference"
  | "workflow_preference"
  | "borrower_workflow"
  | "document_workflow"
  | "email_workflow"
  | "social_workflow"
  | "loan_condition_workflow"
  | "drive_folder_workflow"
  | "prompt_pattern"
  | "saved_instruction"
  | "personal_rule"
  | "assistant_note";
export type AgentMemoryEventType =
  | "memory_write"
  | "memory_update"
  | "memory_correction"
  | "memory_deactivate"
  | "preference_set"
  | "rule_added";
export type AgentSkillUsageOutcome = "used" | "succeeded" | "failed" | "dismissed";
export type AgentToolCallStatus =
  | "ok"
  | "blocked"
  | "error"
  | "needs_confirmation"
  | "skipped";
export type AgentHandoffStatus = "pending" | "accepted" | "declined" | "completed";

export interface AgentSession {
  id: string;
  user_id: string;
  organization_id: string | null;
  agent_type: AgentType;
  title: string | null;
  status: AgentSessionStatus;
  loan_id: string | null;
  loan_memory_id: string | null;
  origin: "web" | "browser_companion" | "handoff" | "api";
  context_summary: string | null;
  last_message_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentMessage {
  id: string;
  session_id: string;
  user_id: string | null;
  agent_type: AgentType;
  role: AgentMessageRole;
  content: string;
  provider: string | null;
  model: string | null;
  trace_id: string | null;
  token_count: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AgentMemory {
  id: string;
  user_id: string;
  organization_id: string | null;
  agent_type: AgentType;
  category: AgentMemoryCategory;
  title: string;
  body: string;
  tags: unknown[];
  confidence: AgentConfidence;
  priority: AgentPriority;
  source_summary: string | null;
  is_active: boolean;
  is_sample: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentMemoryEvent {
  id: string;
  memory_id: string | null;
  user_id: string;
  agent_type: AgentType;
  event_type: AgentMemoryEventType;
  event_summary: string | null;
  source_type: string | null;
  source_name: string | null;
  confidence: AgentConfidence;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AgentSkill {
  id: string;
  user_id: string;
  organization_id: string | null;
  agent_type: AgentType;
  skill_name: string;
  skill_slug: string;
  description: string | null;
  trigger_phrases: unknown[];
  input_schema: Record<string, unknown>;
  output_format: string | null;
  steps: unknown[];
  source_examples: unknown[];
  confidence: AgentConfidence;
  usage_count: number;
  last_used_at: string | null;
  created_by: string | null;
  visibility: AssistantVisibility;
  is_active: boolean;
  is_shared_with_team: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentSkillVersion {
  id: string;
  skill_id: string;
  version: number;
  snapshot: Record<string, unknown>;
  change_summary: string | null;
  created_by: string | null;
  created_at: string;
}

export interface AgentSkillUsage {
  id: string;
  skill_id: string;
  user_id: string;
  session_id: string | null;
  agent_type: AgentType;
  outcome: AgentSkillUsageOutcome;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AgentToolCall {
  id: string;
  session_id: string | null;
  user_id: string;
  agent_type: AgentType;
  tool_name: string;
  input_summary: string | null;
  output_summary: string | null;
  status: AgentToolCallStatus;
  permissioned: boolean;
  audited: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AgentTrace {
  id: string;
  session_id: string | null;
  message_id: string | null;
  user_id: string;
  agent_type: AgentType;
  input_summary: string | null;
  context_loaded: unknown[];
  skills_used: unknown[];
  tools_called: unknown[];
  provider: string | null;
  model_used: string | null;
  output_type: string | null;
  duration_ms: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AgentHandoff {
  id: string;
  from_session_id: string | null;
  to_session_id: string | null;
  from_user_id: string;
  to_user_id: string | null;
  from_agent_type: AgentType;
  to_agent_type: AgentType;
  reason: string | null;
  context_summary: string | null;
  status: AgentHandoffStatus;
  metadata: Record<string, unknown>;
  accepted_at: string | null;
  created_at: string;
}

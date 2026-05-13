// Minimal hand-typed schema. After Supabase is wired up, regenerate with:
//   supabase gen types typescript --project-id <ref> > types/database.ts
// For now we keep this lean and focused on the columns the app actually reads
// and writes so the rest of the codebase stays type-safe.

export type UserRole =
  | "owner"
  | "admin"
  | "loan_officer"
  | "processor"
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

export interface AtlasAssistant {
  id: string;
  organization_id: string | null;
  owner_user_id: string | null;
  name: string;
  description: string | null;
  visibility: AssistantVisibility;
  system_prompt: string | null;
  model: string | null;
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

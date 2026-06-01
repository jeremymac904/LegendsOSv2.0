import { z } from "zod";

export const LEAD_SOURCE_SYSTEMS = [
  "fhbn",
  "ai_realtor_pro",
  "jeremy_mortgage_site",
  "legends_team_site",
  "legendsos",
  "social",
  "email_newsletter",
  "manual_import",
  "follow_up_boss",
  "google_business_profile",
  "unknown",
] as const;

export const LEAD_TYPES = [
  "mortgage",
  "buyer",
  "investor",
  "seller",
  "realtor_partner",
  "provider_partner",
  "referral_partner",
  "recruiting",
  "past_client",
  "idx_notify",
  "chat",
  "content_reply",
  "unknown_needs_review",
] as const;

export const LEAD_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export type LeadSourceSystem = (typeof LEAD_SOURCE_SYSTEMS)[number];
export type LeadType = (typeof LEAD_TYPES)[number];
export type LeadPriority = (typeof LEAD_PRIORITIES)[number];

const trimmedString = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null))
  .nullish();

const stringRecord = z.record(z.unknown()).default({});

export const leadIntakePayloadSchema = z.object({
  source_system: z.enum(LEAD_SOURCE_SYSTEMS).default("unknown"),
  source_product: trimmedString,
  source_channel: trimmedString,
  source_page: trimmedString,
  source_component: trimmedString,
  source_url: trimmedString,
  utm: z
    .object({
      source: trimmedString,
      medium: trimmedString,
      campaign: trimmedString,
      content: trimmedString,
      term: trimmedString,
    })
    .partial()
    .default({}),
  lead_type: z.enum(LEAD_TYPES).default("unknown_needs_review"),
  intent: trimmedString,
  priority: z.enum(LEAD_PRIORITIES).default("normal"),
  person: z
    .object({
      name: trimmedString,
      email: trimmedString,
      phone: trimmedString,
      preferred_contact: trimmedString,
    })
    .default({}),
  market: z
    .object({
      state: trimmedString,
      metro_slug: trimmedString,
      city: trimmedString,
      county: trimmedString,
    })
    .default({}),
  relationship: z
    .object({
      related_pro_slug: trimmedString,
      related_listing_id: trimmedString,
      related_realtor_name: trimmedString,
      related_campaign_id: trimmedString,
    })
    .default({}),
  message: trimmedString,
  metadata: stringRecord,
  consent: z
    .object({
      privacy_acknowledged: z.boolean().default(false),
      marketing_opt_in: z.boolean().default(false),
      sms_opt_in: z.boolean().default(false),
    })
    .partial()
    .default({}),
  created_at: trimmedString,
});

export type LeadIntakePayload = z.infer<typeof leadIntakePayloadSchema>;

export interface LeadIntakeEvent {
  id: string;
  source_system: LeadSourceSystem;
  source_product: string | null;
  source_channel: string | null;
  source_page: string | null;
  source_component: string | null;
  source_url: string | null;
  utm: Record<string, unknown>;
  lead_type: LeadType;
  intent: string | null;
  priority: LeadPriority;
  person: Record<string, unknown>;
  market: Record<string, unknown>;
  relationship: Record<string, unknown>;
  message: string | null;
  metadata: Record<string, unknown>;
  consent: Record<string, unknown>;
  dedupe_key: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketingContact {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  contact_type: LeadType;
  source_first: string | null;
  source_last: string | null;
  metro_slug: string | null;
  state: string | null;
  tags: unknown[];
  consent: Record<string, unknown>;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadAssignment {
  id: string;
  lead_event_id: string;
  contact_id: string | null;
  assigned_owner_id: string | null;
  assigned_agent_type: string;
  assignment_reason: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface LeadFollowupTask {
  id: string;
  lead_event_id: string;
  contact_id: string | null;
  task_type: string;
  title: string;
  draft_body: string | null;
  channel: string;
  status: string;
  requires_approval: boolean;
  approved_by: string | null;
  approved_at: string | null;
  due_at: string | null;
  created_at: string;
  updated_at: string;
}

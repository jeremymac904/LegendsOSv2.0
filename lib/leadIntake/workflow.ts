import type { SupabaseClient } from "@supabase/supabase-js";

import { createHandoff } from "@/lib/agents/handoffs";
import type { AgentHandoff, AgentType as RuntimeAgentType } from "@/lib/agents/types";
import { PUBLIC_ENV } from "@/lib/env";
import type {
  LeadIntakePayload,
  LeadAssignment,
  LeadFollowupTask,
  LeadIntakeEvent,
  LeadType,
  MarketingContact,
} from "@/lib/leadIntake/types";

type AgentType = "owner_atlas" | "marketing_agent";

interface WorkflowResult {
  leadEvent: LeadIntakeEvent;
  contact: MarketingContact | null;
  assignment: LeadAssignment | null;
  tasks: LeadFollowupTask[];
  atlasHandoff: AgentHandoff | null;
}

const PARTNER_TYPES = new Set<LeadType>([
  "realtor_partner",
  "provider_partner",
  "referral_partner",
]);

function normalizeEmail(value: string | null | undefined): string | null {
  return value ? value.trim().toLowerCase() : null;
}

function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function compactObject<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== null && value !== undefined)
  );
}

function createdAtOrNow(value: string | null | undefined): string {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function dedupeKey(payload: LeadIntakePayload): string {
  const email = normalizeEmail(payload.person.email);
  const phone = normalizePhone(payload.person.phone);
  const identity = email ? `email:${email}` : phone ? `phone:${phone}` : `name:${payload.person.name ?? "unknown"}`;
  const campaign = payload.utm.campaign ?? payload.relationship.related_campaign_id ?? "no_campaign";
  return [
    payload.source_system,
    payload.lead_type,
    payload.intent ?? "unknown_intent",
    campaign,
    identity,
  ].join("|");
}

function routeFor(payload: LeadIntakePayload): {
  agentType: AgentType;
  reason: string;
  status: "needs_review" | "assigned";
} {
  if (payload.lead_type === "unknown_needs_review") {
    return {
      agentType: "owner_atlas",
      reason: "Unknown lead type requires owner/admin review before outreach.",
      status: "needs_review",
    };
  }

  if (payload.lead_type === "realtor_partner") {
    return {
      agentType: "marketing_agent",
      reason: "Realtor partner lead routes to Marketing Assistant plus owner oversight.",
      status: "assigned",
    };
  }

  if (payload.lead_type === "provider_partner") {
    return {
      agentType: "owner_atlas",
      reason: "Provider partner lead requires owner/admin review before any placement or onboarding promise.",
      status: "needs_review",
    };
  }

  if (payload.source_system === "social" || payload.source_system === "email_newsletter") {
    return {
      agentType: "marketing_agent",
      reason: "Newsletter/social lead preserves campaign attribution and routes to draft-only marketing follow-up.",
      status: "assigned",
    };
  }

  return {
    agentType: "owner_atlas",
    reason: "Mortgage, buyer, investor, and general lead intake routes to Atlas owner workflow.",
    status: "assigned",
  };
}

function ownerQueryEmail(): string {
  return PUBLIC_ENV.OWNER_EMAIL.trim().toLowerCase();
}

async function resolveDefaultOwnerId(client: SupabaseClient): Promise<string | null> {
  const ownerEmail = ownerQueryEmail();
  if (ownerEmail) {
    const { data } = await client
      .from("profiles")
      .select("id")
      .eq("email", ownerEmail)
      .maybeSingle();
    if ((data as { id?: string } | null)?.id) return (data as { id: string }).id;
  }

  const { data } = await client
    .from("profiles")
    .select("id")
    .in("role", ["owner", "admin"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as { id?: string } | null)?.id ?? null;
}

async function upsertContact(
  client: SupabaseClient,
  payload: LeadIntakePayload,
  ownerId: string | null
): Promise<MarketingContact | null> {
  const email = normalizeEmail(payload.person.email);
  const phone = normalizePhone(payload.person.phone);
  if (!email && !phone && !payload.person.name) return null;

  let existing: MarketingContact | null = null;
  if (email) {
    const { data } = await client
      .from("marketing_contacts")
      .select("*")
      .eq("email", email)
      .maybeSingle();
    existing = (data as MarketingContact | null) ?? null;
  }
  if (!existing && phone) {
    const { data } = await client
      .from("marketing_contacts")
      .select("*")
      .eq("phone", phone)
      .maybeSingle();
    existing = (data as MarketingContact | null) ?? null;
  }

  const tags = new Set<string>(
    Array.isArray(existing?.tags) ? existing.tags.filter((tag): tag is string => typeof tag === "string") : []
  );
  tags.add(payload.source_system);
  tags.add(payload.lead_type);
  if (payload.utm.campaign) tags.add(`campaign:${payload.utm.campaign}`);

  const row = {
    full_name: payload.person.name ?? existing?.full_name ?? null,
    email: email ?? existing?.email ?? null,
    phone: phone ?? existing?.phone ?? null,
    contact_type: existing?.contact_type === "unknown_needs_review" ? payload.lead_type : existing?.contact_type ?? payload.lead_type,
    source_first: existing?.source_first ?? payload.source_system,
    source_last: payload.source_system,
    metro_slug: payload.market.metro_slug ?? existing?.metro_slug ?? null,
    state: payload.market.state ?? existing?.state ?? null,
    tags: Array.from(tags),
    consent: {
      ...(existing?.consent ?? {}),
      ...compactObject(payload.consent),
    },
    owner_id: existing?.owner_id ?? ownerId,
  };

  if (existing) {
    const { data, error } = await client
      .from("marketing_contacts")
      .update(row)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return data as MarketingContact;
  }

  const { data, error } = await client
    .from("marketing_contacts")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return data as MarketingContact;
}

function sourceLabel(payload: LeadIntakePayload): string {
  return [
    payload.source_product,
    payload.source_system,
    payload.source_page,
    payload.utm.campaign ? `campaign ${payload.utm.campaign}` : null,
  ]
    .filter(Boolean)
    .join(" / ");
}

function leadName(payload: LeadIntakePayload): string {
  return payload.person.name ?? payload.person.email ?? payload.person.phone ?? "Unknown lead";
}

function marketLabel(payload: LeadIntakePayload): string {
  return [
    payload.market.city,
    payload.market.metro_slug,
    payload.market.county,
    payload.market.state,
  ]
    .filter(Boolean)
    .join(", ") || "Not provided";
}

function relationshipLabel(payload: LeadIntakePayload): string {
  return [
    payload.relationship.related_realtor_name,
    payload.relationship.related_pro_slug,
    payload.relationship.related_listing_id ? `listing ${payload.relationship.related_listing_id}` : null,
    payload.relationship.related_campaign_id ? `campaign ${payload.relationship.related_campaign_id}` : null,
  ]
    .filter(Boolean)
    .join(" / ") || "None recorded";
}

function preferredChannel(payload: LeadIntakePayload): "email" | "sms" | "phone" {
  const preferred = payload.person.preferred_contact?.toLowerCase();
  if (preferred?.includes("sms") || preferred?.includes("text")) return "sms";
  if (preferred?.includes("phone") || preferred?.includes("call")) return "phone";
  if (payload.person.email) return "email";
  if (payload.person.phone) return payload.consent.sms_opt_in ? "sms" : "phone";
  return "email";
}

function buildLeadSummary(payload: LeadIntakePayload, routeReason: string): string {
  const agent = routeFor(payload).agentType;
  const urgency = payload.priority === "urgent" || payload.priority === "high" ? payload.priority : "normal";
  return [
    "Lead summary:",
    `- Name: ${leadName(payload)}`,
    `- Source: ${sourceLabel(payload) || "Unknown source"}`,
    `- Intent: ${payload.intent ?? payload.lead_type}`,
    `- Market: ${marketLabel(payload)}`,
    `- Related Realtor/provider/listing: ${relationshipLabel(payload)}`,
    `- Urgency: ${urgency}`,
    "",
    "Recommended route:",
    `- Owner: Jeremy/default owner review`,
    `- Agent: ${agent}`,
    `- Workflow: ${routeReason}`,
    "",
    "Risk/compliance check:",
    "- Do not send email, SMS, social reply, CRM/FUB update, or production webhook until a human approves.",
    "- Do not make rate, approval, underwriting, legal, tax, or guarantee claims.",
    "- If this becomes an active borrower/application, link to a loan file only after human review.",
    "",
    "Next actions:",
    "1. Review the source, UTM, consent, and relationship metadata.",
    "2. Approve or revise the follow-up draft.",
    "3. Decide whether to keep in nurture, schedule a call, or hand off to the right team member.",
    "",
    "Approval needed:",
    "- Yes, before any external contact or CRM write.",
  ].join("\n");
}

function buildFollowUpDraft(payload: LeadIntakePayload): string {
  const name = payload.person.name?.split(/\s+/)[0] ?? "there";
  const source = payload.source_product ?? payload.source_system;
  const intent = payload.intent ?? payload.lead_type.replace(/_/g, " ");

  if (payload.lead_type === "realtor_partner") {
    return [
      `Hi ${name},`,
      "",
      `Thanks for reaching out through ${source}. I saw your interest around ${intent}.`,
      "",
      "I can help map out a practical co-marketing or buyer-financing follow-up plan without overcomplicating it. What market are you focused on right now, and are you looking for buyer education, open-house follow-up, or a broader partner campaign?",
      "",
      "Jeremy McDonald, NMLS 1195266, The Legends Mortgage Team powered by Loan Factory, NMLS 320841.",
    ].join("\n");
  }

  if (payload.lead_type === "provider_partner") {
    return [
      `Hi ${name},`,
      "",
      `Thanks for reaching out through ${source}. I received your provider/partner inquiry and will review the fit before making any recommendations or introductions.`,
      "",
      "Can you send a quick overview of the service area, license/insurance status if applicable, and the kind of homeowners or buyers you support?",
      "",
      "Jeremy McDonald, NMLS 1195266, The Legends Mortgage Team powered by Loan Factory, NMLS 320841.",
    ].join("\n");
  }

  return [
    `Hi ${name},`,
    "",
    `Thanks for reaching out through ${source}. I saw your note about ${intent}${marketLabel(payload) !== "Not provided" ? ` in ${marketLabel(payload)}` : ""}.`,
    "",
    "A good next step is to understand your timeline, purchase/refinance goals, and whether you already have a Realtor involved. From there, I can point you toward the right preapproval or planning path.",
    "",
    "What is the best way and time to follow up?",
    "",
    "Jeremy McDonald, NMLS 1195266, The Legends Mortgage Team powered by Loan Factory, NMLS 320841.",
  ].join("\n");
}

function buildCallScript(payload: LeadIntakePayload): string {
  return [
    `Opening: Hi, this is Jeremy with The Legends Mortgage Team. I’m following up on your ${payload.lead_type.replace(/_/g, " ")} request from ${sourceLabel(payload) || "our site"}.`,
    "Confirm: Is now still a good time, and what prompted you to reach out?",
    `Context to verify: intent=${payload.intent ?? "unknown"}, market=${marketLabel(payload)}, relationship=${relationshipLabel(payload)}.`,
    "Qualify: timeline, location, purchase/refi/investment goal, Realtor relationship, and preferred follow-up channel.",
    "Close: explain the next reviewed step. Do not quote rates or guarantee approval.",
  ].join("\n");
}

function buildCrmDraft(payload: LeadIntakePayload): string {
  return [
    "Draft-only CRM/FUB action:",
    `- Create/update contact for ${leadName(payload)}.`,
    `- Source: ${sourceLabel(payload) || payload.source_system}.`,
    `- Lead type: ${payload.lead_type}.`,
    `- Intent: ${payload.intent ?? "not provided"}.`,
    "- Do not write to CRM/FUB until explicitly approved by Jeremy/admin.",
  ].join("\n");
}

async function createAtlasDraftHandoff(
  client: SupabaseClient,
  payload: LeadIntakePayload,
  ownerId: string | null,
  lead: LeadIntakeEvent,
  assignment: LeadAssignment,
  tasks: LeadFollowupTask[],
  routeReason: string
): Promise<AgentHandoff | null> {
  if (!ownerId) return null;

  const summaryTask = tasks.find((task) => task.task_type === "lead_summary");
  const approvalTaskIds = tasks
    .filter((task) => task.requires_approval)
    .map((task) => task.id);
  const handoff = await createHandoff(client, {
    fromUserId: ownerId,
    fromAgentType: assignment.assigned_agent_type as RuntimeAgentType,
    toAgentType: "owner_atlas",
    toUserId: ownerId,
    reason: `Lead intake review: ${leadName(payload)}`,
    contextSummary:
      summaryTask?.draft_body ??
      [
        `Lead ${leadName(payload)} arrived from ${sourceLabel(payload) || payload.source_system}.`,
        routeReason,
        "Draft follow-up tasks were created for human review. No external action was taken.",
      ].join("\n"),
    metadata: {
      source: "lead_intake",
      lead_event_id: lead.id,
      assignment_id: assignment.id,
      contact_id: assignment.contact_id,
      task_ids: tasks.map((task) => task.id),
      approval_task_ids: approvalTaskIds,
      assigned_agent_type: assignment.assigned_agent_type,
      no_external_actions: true,
    },
  });

  return handoff.ok ? handoff.handoff : null;
}

export async function processLeadIntake(
  client: SupabaseClient,
  payload: LeadIntakePayload
): Promise<WorkflowResult> {
  const route = routeFor(payload);
  const ownerId = await resolveDefaultOwnerId(client);
  const contact = await upsertContact(client, payload, ownerId);
  const eventCreatedAt = createdAtOrNow(payload.created_at);
  const metadata = {
    ...compactObject(payload.metadata),
    atlas_summary_version: "lead-intake-v1",
  };

  const { data: leadEvent, error: leadError } = await client
    .from("lead_intake_events")
    .insert({
      source_system: payload.source_system,
      source_product: payload.source_product ?? null,
      source_channel: payload.source_channel ?? null,
      source_page: payload.source_page ?? null,
      source_component: payload.source_component ?? null,
      source_url: payload.source_url ?? null,
      utm: compactObject(payload.utm),
      lead_type: payload.lead_type,
      intent: payload.intent ?? null,
      priority: payload.priority,
      person: compactObject({
        name: payload.person.name,
        email: normalizeEmail(payload.person.email),
        phone: normalizePhone(payload.person.phone),
        preferred_contact: payload.person.preferred_contact,
      }),
      market: compactObject(payload.market),
      relationship: compactObject(payload.relationship),
      message: payload.message ?? null,
      metadata,
      consent: compactObject(payload.consent),
      dedupe_key: dedupeKey(payload),
      status: route.status,
      created_at: eventCreatedAt,
    })
    .select("*")
    .single();
  if (leadError) throw leadError;

  const lead = leadEvent as LeadIntakeEvent;

  const { data: assignment, error: assignmentError } = await client
    .from("lead_assignments")
    .insert({
      lead_event_id: lead.id,
      contact_id: contact?.id ?? null,
      assigned_owner_id: ownerId,
      assigned_agent_type: route.agentType,
      assignment_reason: route.reason,
      status: route.status === "needs_review" ? "needs_review" : "assigned",
    })
    .select("*")
    .single();
  if (assignmentError) throw assignmentError;

  const taskRows = [
    {
      lead_event_id: lead.id,
      contact_id: contact?.id ?? null,
      task_type: "lead_summary",
      title: `Atlas lead summary: ${leadName(payload)}`,
      draft_body: buildLeadSummary(payload, route.reason),
      channel: "internal",
      status: "needs_review",
      requires_approval: false,
    },
    {
      lead_event_id: lead.id,
      contact_id: contact?.id ?? null,
      task_type: "first_follow_up",
      title: `Review first follow-up draft for ${leadName(payload)}`,
      draft_body: buildFollowUpDraft(payload),
      channel: preferredChannel(payload),
      status: "pending_approval",
      requires_approval: true,
      due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      lead_event_id: lead.id,
      contact_id: contact?.id ?? null,
      task_type: "call_script",
      title: `Call script for ${leadName(payload)}`,
      draft_body: buildCallScript(payload),
      channel: "phone",
      status: "pending_approval",
      requires_approval: true,
    },
    {
      lead_event_id: lead.id,
      contact_id: contact?.id ?? null,
      task_type: "crm_action_draft",
      title: `Draft-only CRM action for ${leadName(payload)}`,
      draft_body: buildCrmDraft(payload),
      channel: "crm",
      status: "pending_approval",
      requires_approval: true,
    },
  ];

  const { data: tasks, error: taskError } = await client
    .from("lead_followup_tasks")
    .insert(taskRows)
    .select("*");
  if (taskError) throw taskError;
  const taskList = (tasks ?? []) as LeadFollowupTask[];

  const atlasHandoff = await createAtlasDraftHandoff(
    client,
    payload,
    ownerId,
    lead,
    assignment as LeadAssignment,
    taskList,
    route.reason
  );

  await client.from("marketing_attribution_events").insert({
    contact_id: contact?.id ?? null,
    lead_event_id: lead.id,
    event_type: "lead_intake_received",
    source_system: payload.source_system,
    source_url: payload.source_url ?? null,
    campaign_id: payload.utm.campaign ?? payload.relationship.related_campaign_id ?? null,
    utm: compactObject(payload.utm),
    metadata: {
      lead_type: payload.lead_type,
      source_product: payload.source_product,
      source_page: payload.source_page,
      source_component: payload.source_component,
      no_external_actions: true,
    },
  });

  const finalStatus = route.status === "needs_review" ? "needs_review" : "contact_drafted";
  const { data: updatedLead } = await client
    .from("lead_intake_events")
    .update({
      status: finalStatus,
      metadata: {
        ...metadata,
        atlas_handoff_id: atlasHandoff?.id ?? null,
        atlas_handoff_status: atlasHandoff ? "pending" : "not_created",
      },
    })
    .eq("id", lead.id)
    .select("*")
    .single();

  return {
    leadEvent: (updatedLead as LeadIntakeEvent | null) ?? { ...lead, status: finalStatus },
    contact,
    assignment: assignment as LeadAssignment,
    tasks: taskList,
    atlasHandoff,
  };
}

export function leadNeedsManualReview(payload: LeadIntakePayload): boolean {
  return (
    payload.lead_type === "unknown_needs_review" ||
    PARTNER_TYPES.has(payload.lead_type) ||
    payload.consent.privacy_acknowledged !== true
  );
}

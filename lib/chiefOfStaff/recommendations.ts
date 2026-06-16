// AI Chief of Staff — recommendation engine (v1).
//
// READ-ONLY. This module never writes. It reads data the platform already
// stores (loans, marketing contacts, lead intake events, automation jobs) and
// turns it into a prioritized, explainable daily briefing using SIMPLE RULES —
// not AI, not ML. Every recommendation states the exact signal that triggered
// it (the honesty contract).
//
// Fault tolerance: each section is built independently and wrapped so that a
// missing table, a missing column, or an RLS-empty read degrades to a useful
// empty state — never a 500 and never a fake production claim.

import { getSupabaseServerClient } from "@/lib/supabase/server";

import type {
  BriefingSection,
  ChiefOfStaffBriefing,
  Confidence,
  Recommendation,
} from "./types";

// Partner contact types live in the "cooling relationships" section; everyone
// else flows through "people to contact". Keep these in one place.
const PARTNER_CONTACT_TYPES = [
  "realtor_partner",
  "provider_partner",
  "referral_partner",
];

// Loan stages that are effectively closed — never "needs attention".
const TERMINAL_LOAN_STAGES = ["funded", "closed", "withdrawn", "past_client"];

// Per-section row caps. We surface a focused list, not a database dump.
const SECTION_LIMIT = 6;
const QUERY_LIMIT = 100;

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const ms = Date.now() - then;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function hoursSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / (1000 * 60 * 60));
}

function titleCase(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

// Sort newest-urgency-first and trim to the section cap.
function rankAndTrim(items: Recommendation[]): Recommendation[] {
  return [...items].sort((a, b) => b.weight - a.weight).slice(0, SECTION_LIMIT);
}

// ---------------------------------------------------------------------------
// Section 1 — People to Contact
// Non-partner marketing contacts that have gone quiet.
// ---------------------------------------------------------------------------
async function buildPeopleToContact(): Promise<BriefingSection> {
  const base = {
    key: "people_to_contact" as const,
    title: "People to Contact",
    blurb: "Contacts who have gone quiet and are due for a touch.",
    emptyMessage:
      "No contacts are overdue right now. As your contact list grows, people who go quiet will surface here.",
  };
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("marketing_contacts")
      .select("id, full_name, email, phone, contact_type, updated_at, created_at")
      .order("updated_at", { ascending: true })
      .limit(QUERY_LIMIT);

    if (error) return { ...base, source: "unavailable", recommendations: [] };

    const rows = (data ?? []) as Array<{
      id: string;
      full_name: string | null;
      email: string | null;
      phone: string | null;
      contact_type: string | null;
      updated_at: string | null;
      created_at: string | null;
    }>;

    const recs: Recommendation[] = [];
    for (const row of rows) {
      const type = row.contact_type ?? "";
      if (PARTNER_CONTACT_TYPES.includes(type)) continue; // handled elsewhere
      const days = daysSince(row.updated_at) ?? daysSince(row.created_at);
      if (days === null || days < 30) continue; // only quiet contacts

      let confidence: Confidence = "Low";
      if (days >= 90) confidence = "High";
      else if (days >= 60) confidence = "Medium";

      const name = row.full_name?.trim() || row.email || "Unnamed contact";
      const channel = row.phone ? "a quick call or text" : "a short email";
      recs.push({
        id: `contact:${row.id}`,
        title: name,
        whyItMatters: `No recorded touch in ${days} days${
          type ? ` · ${titleCase(type)}` : ""
        }. Relationships fade without contact.`,
        suggestedAction: `Reach out with ${channel} to re-open the conversation.`,
        sourceSignal: `marketing_contacts.updated_at is ${days} days old`,
        confidence,
        weight: days + (confidence === "High" ? 1000 : confidence === "Medium" ? 500 : 0),
      });
    }

    return {
      ...base,
      source: recs.length ? "db" : "empty",
      recommendations: rankAndTrim(recs),
    };
  } catch {
    return { ...base, source: "unavailable", recommendations: [] };
  }
}

// ---------------------------------------------------------------------------
// Section 2 — Loans Needing Attention
// Active loans that are blocked, high priority, or stale.
// ---------------------------------------------------------------------------
async function buildLoansNeedingAttention(): Promise<BriefingSection> {
  const base = {
    key: "loans_needing_attention" as const,
    title: "Loans Needing Attention",
    blurb: "Active files that look blocked, urgent, or stalled.",
    emptyMessage:
      "No active loans look blocked or stale. Assigned loans that go quiet or get flagged will appear here.",
  };
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("loans")
      .select(
        "id, loan_number, loan_program, stage, stage_status, priority, drive_url, updated_at, borrowers(full_name,is_primary)"
      )
      .order("updated_at", { ascending: true })
      .limit(QUERY_LIMIT);

    if (error) return { ...base, source: "unavailable", recommendations: [] };

    const rows = (data ?? []) as Array<{
      id: string;
      loan_number: string | null;
      loan_program: string | null;
      stage: string | null;
      stage_status: string | null;
      priority: string | null;
      drive_url: string | null;
      updated_at: string | null;
      borrowers?: { full_name: string; is_primary: boolean }[];
    }>;

    const recs: Recommendation[] = [];
    for (const row of rows) {
      if (row.stage && TERMINAL_LOAN_STAGES.includes(row.stage)) continue;

      const blocked = row.stage_status === "blocked";
      const priority = (row.priority ?? "normal").toLowerCase();
      const urgent = priority === "urgent";
      const high = priority === "high";
      const days = daysSince(row.updated_at);
      const stale = days !== null && days >= 7;

      if (!blocked && !urgent && !high && !stale) continue;

      const borrowers = row.borrowers ?? [];
      const primary = borrowers.find((b) => b.is_primary) ?? borrowers[0];
      const who = primary?.full_name || row.loan_number || "Loan file";

      // Strongest signal wins for the headline + confidence.
      let confidence: Confidence = "Medium";
      let signal = "";
      let why = "";
      if (blocked) {
        confidence = "High";
        signal = "loans.stage_status = 'blocked'";
        why = "This file is explicitly marked blocked and is not moving.";
      } else if (urgent) {
        confidence = "High";
        signal = "loans.priority = 'urgent'";
        why = "Marked urgent — it needs movement today.";
      } else if (high) {
        confidence = "Medium";
        signal = "loans.priority = 'high'";
        why = "High priority and still open.";
      } else {
        confidence = days !== null && days >= 14 ? "High" : "Medium";
        signal = `loans.updated_at is ${days} days old`;
        why = `No update in ${days} days — it may be stuck.`;
      }

      const weight =
        (blocked ? 2000 : urgent ? 1800 : high ? 1000 : 600) + (days ?? 0);

      recs.push({
        id: `loan:${row.id}`,
        title: who + (row.loan_number ? ` · #${row.loan_number}` : ""),
        whyItMatters: `${why}${row.stage ? ` Stage: ${titleCase(row.stage)}.` : ""}`,
        suggestedAction: blocked
          ? "Open the file, clear or escalate the blocker, and log the next step."
          : "Review the file and record the next action so it keeps moving.",
        sourceSignal: signal,
        confidence,
        href: "/my-loans",
        hrefLabel: "Open My Loans",
        weight,
      });
    }

    return {
      ...base,
      source: recs.length ? "db" : "empty",
      recommendations: rankAndTrim(recs),
    };
  } catch {
    return { ...base, source: "unavailable", recommendations: [] };
  }
}

// ---------------------------------------------------------------------------
// Section 3 — Agent Relationships Cooling Off
// Referral / realtor / provider partners with no recent activity.
// ---------------------------------------------------------------------------
async function buildCoolingRelationships(): Promise<BriefingSection> {
  const base = {
    key: "agent_relationships_cooling" as const,
    title: "Agent Relationships Cooling Off",
    blurb: "Referral partners and agents who have gone quiet.",
    emptyMessage:
      "No partner relationships look cold. Realtor and referral partners with no recent activity will surface here.",
  };
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("marketing_contacts")
      .select("id, full_name, email, phone, contact_type, updated_at, created_at")
      .in("contact_type", PARTNER_CONTACT_TYPES)
      .order("updated_at", { ascending: true })
      .limit(QUERY_LIMIT);

    if (error) return { ...base, source: "unavailable", recommendations: [] };

    const rows = (data ?? []) as Array<{
      id: string;
      full_name: string | null;
      email: string | null;
      phone: string | null;
      contact_type: string | null;
      updated_at: string | null;
      created_at: string | null;
    }>;

    const recs: Recommendation[] = [];
    for (const row of rows) {
      const days = daysSince(row.updated_at) ?? daysSince(row.created_at);
      if (days === null || days < 30) continue;

      let confidence: Confidence = "Low";
      if (days >= 60) confidence = "High";
      else if (days >= 45) confidence = "Medium";

      const name = row.full_name?.trim() || row.email || "Partner";
      recs.push({
        id: `partner:${row.id}`,
        title: `${name}${row.contact_type ? ` · ${titleCase(row.contact_type)}` : ""}`,
        whyItMatters: `No activity in ${days} days. Referral partners need consistent touchpoints to keep sending business.`,
        suggestedAction:
          "Send a personal check-in or share something useful to re-warm the relationship.",
        sourceSignal: `marketing_contacts.updated_at is ${days} days old (partner)`,
        confidence,
        weight: days + (confidence === "High" ? 1000 : confidence === "Medium" ? 500 : 0),
      });
    }

    return {
      ...base,
      source: recs.length ? "db" : "empty",
      recommendations: rankAndTrim(recs),
    };
  } catch {
    return { ...base, source: "unavailable", recommendations: [] };
  }
}

// ---------------------------------------------------------------------------
// Section 4 — Opportunities
// Lead intake events that are new, unreviewed, or high priority.
// ---------------------------------------------------------------------------
async function buildOpportunities(): Promise<BriefingSection> {
  const base = {
    key: "opportunities" as const,
    title: "Opportunities",
    blurb: "Fresh leads and scenarios worth acting on.",
    emptyMessage:
      "No open opportunities need action. New leads and unreviewed inquiries will appear here as they arrive.",
  };
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("lead_intake_events")
      .select("id, lead_type, intent, priority, person, status, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(QUERY_LIMIT);

    if (error) return { ...base, source: "unavailable", recommendations: [] };

    const rows = (data ?? []) as Array<{
      id: string;
      lead_type: string | null;
      intent: string | null;
      priority: string | null;
      person: { name?: string; email?: string } | null;
      status: string | null;
      created_at: string | null;
      updated_at: string | null;
    }>;

    const closedStatuses = ["converted", "lost", "spam"];
    const actionableStatuses = ["new", "needs_review", "qualified"];

    const recs: Recommendation[] = [];
    for (const row of rows) {
      const status = (row.status ?? "new").toLowerCase();
      if (closedStatuses.includes(status)) continue;

      const priority = (row.priority ?? "normal").toLowerCase();
      const urgent = priority === "urgent";
      const high = priority === "high";
      const needsAction = actionableStatuses.includes(status);
      const days = daysSince(row.created_at);
      const aging = days !== null && days >= 30;

      if (!urgent && !high && !needsAction && !aging) continue;

      let confidence: Confidence = "Medium";
      let signal = "";
      if (urgent) {
        confidence = "High";
        signal = "lead_intake_events.priority = 'urgent'";
      } else if (status === "new" || status === "needs_review") {
        confidence = "Medium";
        signal = `lead_intake_events.status = '${status}'`;
      } else if (high) {
        confidence = "Medium";
        signal = "lead_intake_events.priority = 'high'";
      } else {
        confidence = "Low";
        signal = `lead_intake_events.created_at is ${days} days old, still open`;
      }

      const name = row.person?.name?.trim() || row.person?.email || "New lead";
      const kind = titleCase(row.lead_type) || "Lead";
      recs.push({
        id: `lead:${row.id}`,
        title: `${name} · ${kind}`,
        whyItMatters:
          status === "new" || status === "needs_review"
            ? "A new inquiry is waiting for triage. Speed to lead wins deals."
            : urgent || high
              ? "Flagged as a priority opportunity and still open."
              : `Open for ${days} days without resolution.`,
        suggestedAction: needsAction
          ? "Review the lead and start the first follow-up."
          : "Advance this opportunity with a concrete next step.",
        sourceSignal: signal,
        confidence,
        href: "/email-intake",
        hrefLabel: "Open intake queue",
        weight:
          (urgent ? 2000 : needsAction ? 1200 : high ? 1000 : 400) +
          (days ?? 0),
      });
    }

    return {
      ...base,
      source: recs.length ? "db" : "empty",
      recommendations: rankAndTrim(recs),
    };
  } catch {
    return { ...base, source: "unavailable", recommendations: [] };
  }
}

// ---------------------------------------------------------------------------
// Section 5 — Broken or Stale Automations
// Automation jobs that failed or stalled in the queue.
// ---------------------------------------------------------------------------
async function buildBrokenAutomations(): Promise<BriefingSection> {
  const base = {
    key: "broken_automations" as const,
    title: "Broken or Stale Automations",
    blurb: "Automation jobs that failed or are stuck.",
    emptyMessage:
      "All automations look healthy. Failed or stalled jobs will appear here so nothing fails silently.",
  };
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("automation_jobs")
      .select("id, job_type, module, status, attempts, last_error, updated_at, created_at")
      .in("status", ["failed", "queued", "sent"])
      .order("updated_at", { ascending: true })
      .limit(QUERY_LIMIT);

    if (error) return { ...base, source: "unavailable", recommendations: [] };

    const rows = (data ?? []) as Array<{
      id: string;
      job_type: string | null;
      module: string | null;
      status: string | null;
      attempts: number | null;
      last_error: string | null;
      updated_at: string | null;
      created_at: string | null;
    }>;

    const recs: Recommendation[] = [];
    for (const row of rows) {
      const status = (row.status ?? "").toLowerCase();
      const failed = status === "failed";
      const hrs = hoursSince(row.updated_at);
      const stalled = (status === "queued" || status === "sent") && hrs !== null && hrs >= 1;

      if (!failed && !stalled) continue;

      const label = titleCase(row.job_type) || titleCase(row.module) || "Automation job";
      let confidence: Confidence;
      let why: string;
      let signal: string;
      let action: string;
      if (failed) {
        confidence = "High";
        why = row.last_error
          ? `Failed: ${row.last_error.slice(0, 120)}`
          : `Failed after ${row.attempts ?? 0} attempt(s).`;
        signal = "automation_jobs.status = 'failed'";
        action = "Check the error and re-run or fix the workflow.";
      } else {
        confidence = "Medium";
        why = `Stuck in '${status}' for ${hrs} hour(s) without completing.`;
        signal = `automation_jobs.status = '${status}', not advanced in ${hrs}h`;
        action = "Check the n8n workflow and webhook; re-queue if needed.";
      }

      recs.push({
        id: `job:${row.id}`,
        title: label,
        whyItMatters: why,
        suggestedAction: action,
        sourceSignal: signal,
        confidence,
        href: "/admin/n8n",
        hrefLabel: "Open automation panel",
        weight: (failed ? 2000 : 1000) + (hrs ?? 0),
      });
    }

    return {
      ...base,
      source: recs.length ? "db" : "empty",
      recommendations: rankAndTrim(recs),
    };
  } catch {
    return { ...base, source: "unavailable", recommendations: [] };
  }
}

// ---------------------------------------------------------------------------
// Orchestrator — build the whole briefing. All sections run in parallel and
// each is independently fault-tolerant, so one missing table cannot break the
// page. RLS already scopes every read to the signed-in user, so no profile
// argument is needed here in v1 (per-role tuning can thread it in later).
// ---------------------------------------------------------------------------
export async function buildChiefOfStaffBriefing(): Promise<ChiefOfStaffBriefing> {
  const sections = await Promise.all([
    buildPeopleToContact(),
    buildLoansNeedingAttention(),
    buildCoolingRelationships(),
    buildOpportunities(),
    buildBrokenAutomations(),
  ]);

  let totalCount = 0;
  let highPriorityCount = 0;
  for (const section of sections) {
    totalCount += section.recommendations.length;
    highPriorityCount += section.recommendations.filter(
      (r) => r.confidence === "High"
    ).length;
  }

  return {
    generatedAt: new Date().toISOString(),
    totalCount,
    highPriorityCount,
    sections,
  };
}

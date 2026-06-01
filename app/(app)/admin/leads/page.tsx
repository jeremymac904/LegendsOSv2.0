import Link from "next/link";
import { redirect } from "next/navigation";
import { Bot, CheckCircle2, Clock3, DatabaseZap, FlaskConical, ShieldCheck } from "lucide-react";

import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatCard } from "@/components/ui/StatCard";
import { getEffectiveProfile } from "@/lib/impersonation";
import type {
  LeadAssignment,
  LeadFollowupTask,
  LeadIntakeEvent,
  MarketingContact,
} from "@/lib/leadIntake/types";
import { isAdminOrOwner, isOwner } from "@/lib/permissions";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { formatRelative } from "@/lib/utils";

export const dynamic = "force-dynamic";

const REVIEW_STATUSES = ["new", "needs_review", "contact_drafted", "assigned"];

interface LeadReviewRow {
  lead: LeadIntakeEvent;
  contact: MarketingContact | null;
  assignment: LeadAssignment | null;
  tasks: LeadFollowupTask[];
}

async function loadLeadReviewRows(showAll: boolean): Promise<{
  ok: boolean;
  rows: LeadReviewRow[];
}> {
  try {
    const supabase = getSupabaseServerClient();
    let query = supabase
      .from("lead_intake_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (!showAll) query = query.in("status", REVIEW_STATUSES);

    const { data: leadData, error: leadError } = await query;
    if (leadError) return { ok: false, rows: [] };

    const leads = (leadData ?? []) as LeadIntakeEvent[];
    if (leads.length === 0) return { ok: true, rows: [] };

    const leadIds = leads.map((lead) => lead.id);
    const { data: assignmentData } = await supabase
      .from("lead_assignments")
      .select("*")
      .in("lead_event_id", leadIds);
    const { data: taskData } = await supabase
      .from("lead_followup_tasks")
      .select("*")
      .in("lead_event_id", leadIds)
      .order("created_at", { ascending: true });

    const assignments = ((assignmentData ?? []) as LeadAssignment[]).reduce(
      (map, assignment) => map.set(assignment.lead_event_id, assignment),
      new Map<string, LeadAssignment>()
    );
    const tasksByLead = ((taskData ?? []) as LeadFollowupTask[]).reduce(
      (map, task) => {
        const list = map.get(task.lead_event_id) ?? [];
        list.push(task);
        map.set(task.lead_event_id, list);
        return map;
      },
      new Map<string, LeadFollowupTask[]>()
    );

    const contactIds = Array.from(
      new Set(
        ((assignmentData ?? []) as LeadAssignment[])
          .map((assignment) => assignment.contact_id)
          .filter((id): id is string => Boolean(id))
      )
    );
    const contactsById = new Map<string, MarketingContact>();
    if (contactIds.length > 0) {
      const { data: contactData } = await supabase
        .from("marketing_contacts")
        .select("*")
        .in("id", contactIds);
      for (const contact of (contactData ?? []) as MarketingContact[]) {
        contactsById.set(contact.id, contact);
      }
    }

    return {
      ok: true,
      rows: leads.map((lead) => {
        const assignment = assignments.get(lead.id) ?? null;
        return {
          lead,
          assignment,
          contact: assignment?.contact_id
            ? contactsById.get(assignment.contact_id) ?? null
            : null,
          tasks: tasksByLead.get(lead.id) ?? [],
        };
      }),
    };
  } catch {
    return { ok: false, rows: [] };
  }
}

export default async function AdminLeadReviewPage({
  searchParams,
}: {
  searchParams?: { filter?: string };
}) {
  const { profile } = await getEffectiveProfile();
  if (!isAdminOrOwner(profile)) redirect("/dashboard");

  const showAll = searchParams?.filter === "all";
  const showTestOnly = searchParams?.filter === "test";
  const { ok, rows: allRows } = await loadLeadReviewRows(true);

  // Safe env check — never exposes the value
  const webhookSecretPresent = Boolean(
    process.env.LEGENDSOS_WEBHOOK_SECRET?.trim()
  );

  // Apply filter after load so we can show stats for all leads
  const rows = showTestOnly
    ? allRows.filter((row) => Boolean((row.lead.metadata as Record<string, unknown>)?.test))
    : showAll
      ? allRows
      : allRows.filter((row) => (REVIEW_STATUSES as string[]).includes(row.lead.status));
  const pendingApprovals = allRows.reduce(
    (count, row) =>
      count +
      row.tasks.filter((task) => task.requires_approval && task.status !== "approved").length,
    0
  );
  const needsReview = allRows.filter((row) => row.lead.status === "needs_review").length;
  const drafted = allRows.filter((row) => row.lead.status === "contact_drafted").length;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Admin"
        title="Lead intake review"
        description="Review normalized marketing leads, source/UTM metadata, consent, Atlas summaries, routing, and approval-gated follow-up drafts. No live sends or CRM writes happen here."
        action={
          <div className="flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white p-1 dark:border-ink-800 dark:bg-ink-950/40">
            <FilterTab href="/admin/leads" label="Needs attention" active={!showAll && !showTestOnly} />
            <FilterTab href="/admin/leads?filter=all" label="All" active={showAll} />
            <FilterTab href="/admin/leads?filter=test" label="Test leads" active={showTestOnly} />
          </div>
        }
      />

      {isOwner(profile) && (
        <TestLeadPanel secretPresent={webhookSecretPresent} />
      )}

      <SafetyBanner />

      {!ok ? (
        <MigrationNotice />
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <StatCard label="Leads shown" value={rows.length} icon={Bot} />
            <StatCard label="Need review" value={needsReview} icon={Clock3} tone="warn" />
            <StatCard
              label="Approval-gated drafts"
              value={pendingApprovals}
              icon={ShieldCheck}
              tone={pendingApprovals > 0 ? "warn" : "ok"}
            />
          </div>

          <p className="text-[12px] text-ink-500 dark:text-ink-400">
            Showing{" "}
            <span className="font-medium text-ink-700 dark:text-ink-200">
              {rows.length}
            </span>{" "}
            {showTestOnly
              ? "test lead events"
              : showAll
                ? "lead events across all statuses"
                : "lead events needing review, assignment, or draft approval"}.{" "}
            <span className="text-ink-400">Contact drafted: {drafted}.</span>
          </p>

          <LeadReviewList rows={rows} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Test lead intake panel (owner-only, server-rendered with a JS-free form)
// ---------------------------------------------------------------------------

function TestLeadPanel({ secretPresent }: { secretPresent: boolean }) {
  return (
    <details className="group rounded-xl border border-ink-200 bg-ink-50/60 dark:border-ink-800 dark:bg-ink-900/30">
      <summary className="flex cursor-pointer select-none items-center gap-2.5 px-4 py-3 text-[13px] font-semibold text-ink-800 dark:text-ink-100 [&::-webkit-details-marker]:hidden">
        <FlaskConical
          size={15}
          className="shrink-0 text-ink-500 dark:text-ink-400 group-open:text-accent-gold"
        />
        Test lead intake
        <span className="ml-auto text-[11px] font-normal text-ink-400 dark:text-ink-500 group-open:hidden">
          expand
        </span>
      </summary>

      <div className="border-t border-ink-200 px-4 py-4 dark:border-ink-800">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <div className="flex-1 space-y-1 text-[12.5px] text-ink-600 dark:text-ink-300">
            <p>
              Fires a signed test lead at{" "}
              <code className="rounded bg-ink-100 px-1 font-mono text-[11px] text-ink-700 dark:bg-ink-800 dark:text-ink-200">
                /api/webhooks/lead-intake
              </code>{" "}
              so you can verify the pipeline end-to-end without an external dashboard.
            </p>
            <p>
              Secret configured:{" "}
              {secretPresent ? (
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  Yes — webhook ready
                </span>
              ) : (
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  No — set LEGENDSOS_WEBHOOK_SECRET in Netlify env vars
                </span>
              )}
            </p>
            <p className="text-ink-400 dark:text-ink-500">
              Test leads are tagged{" "}
              <code className="rounded bg-ink-100 px-1 font-mono text-[11px] dark:bg-ink-800">
                metadata.test = true
              </code>{" "}
              and visible via the &ldquo;Test leads&rdquo; filter above.
            </p>
          </div>

          {secretPresent && (
            <form
              action="/api/admin/lead-intake/test"
              method="POST"
              className="shrink-0"
            >
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent-gold/15 px-3 py-2 text-[12.5px] font-semibold text-ink-900 ring-1 ring-accent-gold/40 hover:bg-accent-gold/25 dark:text-ink-100"
              >
                <FlaskConical size={13} />
                Send test lead
              </button>
            </form>
          )}
        </div>
      </div>
    </details>
  );
}

function LeadReviewList({ rows }: { rows: LeadReviewRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center gap-2 p-10 text-center">
        <CheckCircle2 size={20} className="text-emerald-500" />
        <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">
          No lead intake items waiting
        </p>
        <p className="max-w-md text-[12.5px] text-ink-600 dark:text-ink-300">
          When a server-side source posts to <code>/api/webhooks/lead-intake</code>,
          the event, contact, routing, attribution, and draft tasks will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <LeadReviewCard key={row.lead.id} row={row} />
      ))}
    </div>
  );
}

function LeadReviewCard({ row }: { row: LeadReviewRow }) {
  const lead = row.lead;
  const contact = row.contact;
  const summaryTask = row.tasks.find((task) => task.task_type === "lead_summary");
  const followupTasks = row.tasks.filter((task) => task.task_type !== "lead_summary");

  return (
    <article className="card space-y-4 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={lead.status} />
            <span className="rounded-full border border-ink-200 bg-ink-50 px-2 py-0.5 text-[11px] font-medium text-ink-600 dark:border-ink-700 dark:bg-ink-800/40 dark:text-ink-300">
              {lead.lead_type.replace(/_/g, " ")}
            </span>
            <span className="text-[11px] text-ink-500 dark:text-ink-400">
              {formatRelative(lead.created_at)}
            </span>
          </div>
          <h2 className="truncate text-lg font-semibold text-ink-950 dark:text-ink-50">
            {personValue(lead, "name") || contact?.full_name || "Unknown lead"}
          </h2>
          <p className="text-[12.5px] text-ink-600 dark:text-ink-300">
            {[lead.source_product, lead.source_system, lead.source_page]
              .filter(Boolean)
              .join(" / ") || "Unknown source"}
          </p>
        </div>

        <div className="rounded-xl border border-ink-200 bg-ink-50 px-3 py-2 text-[12px] dark:border-ink-800 dark:bg-ink-900/40">
          <p className="font-medium text-ink-800 dark:text-ink-100">
            Route: {row.assignment?.assigned_agent_type ?? "not assigned"}
          </p>
          <p className="mt-1 max-w-md text-ink-500 dark:text-ink-400">
            {row.assignment?.assignment_reason ?? "No assignment record yet."}
          </p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <InfoPanel
          title="Contact and consent"
          rows={[
            ["Email", personValue(lead, "email") || contact?.email || "—"],
            ["Phone", personValue(lead, "phone") || contact?.phone || "—"],
            ["Preferred", personValue(lead, "preferred_contact") || "—"],
            ["Privacy", boolLabel(consentValue(lead, "privacy_acknowledged"))],
            ["Marketing", boolLabel(consentValue(lead, "marketing_opt_in"))],
            ["SMS", boolLabel(consentValue(lead, "sms_opt_in"))],
          ]}
        />
        <InfoPanel
          title="Source and UTM"
          rows={[
            ["System", lead.source_system],
            ["Channel", lead.source_channel || "—"],
            ["Component", lead.source_component || "—"],
            ["Campaign", utmValue(lead, "campaign") || "—"],
            ["Medium", utmValue(lead, "medium") || "—"],
            ["Content", utmValue(lead, "content") || "—"],
          ]}
        />
        <InfoPanel
          title="Market and relationship"
          rows={[
            ["Intent", lead.intent || "—"],
            ["Priority", lead.priority],
            ["Metro", marketValue(lead, "metro_slug") || "—"],
            ["State", marketValue(lead, "state") || "—"],
            ["Realtor", relationValue(lead, "related_realtor_name") || "—"],
            ["Listing", relationValue(lead, "related_listing_id") || "—"],
          ]}
        />
      </div>

      {lead.message && (
        <div className="rounded-xl border border-ink-200 bg-white p-3 dark:border-ink-800 dark:bg-ink-950/30">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-500 dark:text-ink-400">
            Lead message
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-700 dark:text-ink-200">
            {lead.message}
          </p>
        </div>
      )}

      {summaryTask && (
        <DraftBlock
          title={summaryTask.title}
          body={summaryTask.draft_body}
          status={summaryTask.status}
          approval={summaryTask.requires_approval}
        />
      )}

      <div className="grid gap-3 lg:grid-cols-3">
        {followupTasks.map((task) => (
          <DraftBlock
            key={task.id}
            title={task.title}
            body={task.draft_body}
            status={task.status}
            approval={task.requires_approval}
            compact
          />
        ))}
      </div>
    </article>
  );
}

function InfoPanel({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="rounded-xl border border-ink-200 bg-ink-50/70 p-3 dark:border-ink-800 dark:bg-ink-900/30">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-500 dark:text-ink-400">
        {title}
      </p>
      <dl className="mt-2 grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1 text-[12px]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-ink-500 dark:text-ink-400">{label}</dt>
            <dd className="truncate text-ink-800 dark:text-ink-100">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function DraftBlock({
  title,
  body,
  status,
  approval,
  compact,
}: {
  title: string;
  body: string | null;
  status: string;
  approval: boolean;
  compact?: boolean;
}) {
  return (
    <section className="rounded-xl border border-ink-200 bg-white p-3 dark:border-ink-800 dark:bg-ink-950/30">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[12px] font-semibold text-ink-900 dark:text-ink-100">
          {title}
        </p>
        <StatusChip status={status} small />
        {approval && (
          <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
            Approval required
          </span>
        )}
      </div>
      <pre
        className={
          compact
            ? "mt-2 max-h-52 overflow-auto whitespace-pre-wrap rounded-lg bg-ink-50 p-2 text-[11.5px] leading-relaxed text-ink-700 dark:bg-ink-900/50 dark:text-ink-200"
            : "mt-2 whitespace-pre-wrap rounded-lg bg-ink-50 p-3 text-[12.5px] leading-relaxed text-ink-700 dark:bg-ink-900/50 dark:text-ink-200"
        }
      >
        {body || "No draft body recorded."}
      </pre>
    </section>
  );
}

function SafetyBanner() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-500/40 dark:bg-amber-500/10">
      <ShieldCheck
        size={16}
        className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-300"
      />
      <div className="text-[12.5px] leading-relaxed">
        <p className="font-semibold text-amber-800 dark:text-amber-200">
          Draft and review only
        </p>
        <p className="text-amber-700 dark:text-amber-300/90">
          This page tracks source, UTM, consent, routing, and approval state. It
          does not activate live sends, publish social, write to external CRMs,
          or call production webhooks.
        </p>
      </div>
    </div>
  );
}

function MigrationNotice() {
  return (
    <div className="card flex flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-full border border-amber-300 bg-amber-50 text-amber-600 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
        <DatabaseZap size={18} />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">
          Lead intake migration not applied yet
        </p>
        <p className="mx-auto max-w-md text-[12.5px] leading-relaxed text-ink-600 dark:text-ink-300">
          Apply{" "}
          <code className="rounded bg-ink-100 px-1 py-0.5 font-mono text-[11px] text-ink-700 dark:bg-ink-800 dark:text-ink-200">
            supabase/migrations/20260601102000_lead_intake_foundation.sql
          </code>{" "}
          before activating server-side lead sources.
        </p>
      </div>
    </div>
  );
}

function FilterTab({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "rounded-md bg-accent-gold/15 px-2.5 py-1 text-[12px] font-medium text-ink-900 dark:text-ink-100"
          : "rounded-md px-2.5 py-1 text-[12px] font-medium text-ink-500 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100"
      }
    >
      {label}
    </Link>
  );
}

function StatusChip({
  status,
  small,
}: {
  status: string;
  small?: boolean;
}) {
  const tone =
    status.includes("approval") || status === "needs_review"
      ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
      : status === "contact_drafted" || status === "assigned" || status === "approved"
        ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300"
        : "border-ink-200 bg-ink-50 text-ink-600 dark:border-ink-700 dark:bg-ink-800/40 dark:text-ink-300";
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border font-medium",
        small ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
        tone,
      ].join(" ")}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function recordValue(
  record: Record<string, unknown>,
  key: string
): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function personValue(lead: LeadIntakeEvent, key: string): string | null {
  return recordValue(lead.person, key);
}

function utmValue(lead: LeadIntakeEvent, key: string): string | null {
  return recordValue(lead.utm, key);
}

function marketValue(lead: LeadIntakeEvent, key: string): string | null {
  return recordValue(lead.market, key);
}

function relationValue(lead: LeadIntakeEvent, key: string): string | null {
  return recordValue(lead.relationship, key);
}

function consentValue(lead: LeadIntakeEvent, key: string): unknown {
  return lead.consent[key];
}

function boolLabel(value: unknown): string {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "Not recorded";
}

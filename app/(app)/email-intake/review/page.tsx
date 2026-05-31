import { redirect } from "next/navigation";
import Link from "next/link";

import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  IntakeSubnav,
  MigrationNotice,
  PhaseOneBanner,
} from "@/components/emailintake/shared";
import { ReviewQueue } from "@/components/emailintake/ReviewQueue";
import type { IntakeMessage } from "@/lib/emailIntake/types";
import { getEffectiveProfile } from "@/lib/impersonation";
import { isAdminOrOwner } from "@/lib/permissions";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Default filter: items that actually need a human — needs_review +
// awaiting_approval + alert_pending. "all" widens to everything.
const DEFAULT_STATUSES = ["needs_review", "awaiting_approval", "alert_pending"];

interface LoadResult {
  ok: boolean;
  messages: IntakeMessage[];
}

async function loadMessages(showAll: boolean): Promise<LoadResult> {
  try {
    const supabase = getSupabaseServerClient();
    let query = supabase
      .from("email_intake_messages")
      .select("*")
      .order("received_at", { ascending: false, nullsFirst: false })
      .limit(200);
    if (!showAll) query = query.in("status", DEFAULT_STATUSES);

    const { data, error } = await query;
    if (error) return { ok: false, messages: [] };
    return { ok: true, messages: (data ?? []) as IntakeMessage[] };
  } catch {
    return { ok: false, messages: [] };
  }
}

export default async function EmailIntakeReviewPage({
  searchParams,
}: {
  searchParams?: { filter?: string };
}) {
  const { profile } = await getEffectiveProfile();
  if (!isAdminOrOwner(profile)) redirect("/dashboard");

  const showAll = searchParams?.filter === "all";
  const { ok, messages } = await loadMessages(showAll);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Email Intake"
        title="Review queue"
        description="Read-only triage of recorded inbound mail. Open a row to inspect the classification and snippet. No sends or writes in Phase 1."
        action={
          <div className="flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white p-1 dark:border-ink-800 dark:bg-ink-950/40">
            <FilterTab href="/email-intake/review" label="Needs attention" active={!showAll} />
            <FilterTab
              href="/email-intake/review?filter=all"
              label="All"
              active={showAll}
            />
          </div>
        }
      />

      <IntakeSubnav active="/email-intake/review" />

      <PhaseOneBanner />

      {!ok ? (
        <MigrationNotice surface="review queue" />
      ) : (
        <>
          <p className="text-[12px] text-ink-500 dark:text-ink-400">
            Showing{" "}
            <span className="font-medium text-ink-700 dark:text-ink-200">
              {messages.length}
            </span>{" "}
            {showAll
              ? "messages (all statuses)"
              : "messages that need review or approval"}
            .
          </p>
          <ReviewQueue messages={messages} />
        </>
      )}
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

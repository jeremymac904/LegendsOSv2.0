import { redirect } from "next/navigation";

import { SourceConnectorStatus } from "@/components/loanmemory/SourceConnectorStatus";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { connectorsSnapshot } from "@/lib/loanMemory/connectors";
import {
  SCHEDULE_DESCRIPTORS,
  WEBHOOK_CONTRACT_NOTE,
  PLANNED_WEBHOOK_PATH,
} from "@/lib/loanMemory/scheduleConfig";
import { getEffectiveProfile } from "@/lib/impersonation";
import { isAdminOrOwner } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

// Owner/admin planning view for the Loan Memory automation layer. This route is
// intentionally NOT in the nav — it documents the scheduled-refresh PLAN and the
// Friday weekly-update concept. Everything here is read-only and clearly marked
// "not activated". No cron, no n8n, no sends, no Drive writes.
export default async function LoanMemorySchedulePage() {
  const { profile } = await getEffectiveProfile();
  if (!profile) {
    return (
      <EmptyState
        title="Profile unavailable"
        description="We could not load your account profile. Refresh the page or sign in again; if this keeps happening, ask Jeremy to confirm your profile is provisioned."
      />
    );
  }
  if (!isAdminOrOwner(profile)) redirect("/dashboard");

  // Snapshot is computed server-side so no env values reach the client.
  const snapshot = connectorsSnapshot();

  const triggerTone = (t: string) =>
    t === "cron"
      ? "border-status-info/30 bg-status-info/10 text-status-info"
      : "border-status-warn/30 bg-status-warn/10 text-status-warn";

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Loan Memory · Planning"
        title="Scheduled refresh & weekly updates"
        description="The automation plan for keeping loan memory current and producing Friday weekly drafts. This is a planning view — nothing here is activated. No cron is registered, no n8n workflow is enabled, nothing is sent, and no Drive or Sheet writes occur."
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-status-warn/30 bg-status-warn/10 px-4 py-2.5 text-xs text-status-warn">
        <span className="font-semibold uppercase tracking-[0.16em]">Not activated</span>
        <span className="text-status-warn/90">
          Descriptors below are documentation only. A human must turn the automation layer on
          before any task runs.
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* Schedule plan */}
        <section className="space-y-3">
          <h2 className="text-[13px] font-semibold tracking-tight text-ink-900 dark:text-ink-100">
            Scheduled tasks (planned)
          </h2>
          <ul className="space-y-2.5">
            {SCHEDULE_DESCRIPTORS.map((d) => (
              <li
                key={d.id}
                className="rounded-2xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-950/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[14px] font-medium text-ink-900 dark:text-ink-100">
                    {d.label}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em]",
                        triggerTone(d.trigger)
                      )}
                    >
                      {d.trigger === "cron" ? d.cron : `event · ${d.event}`}
                    </span>
                    {d.draftOnly && (
                      <span className="rounded-full border border-ink-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-600 dark:border-ink-700 dark:text-ink-300">
                        draft-only
                      </span>
                    )}
                  </div>
                </div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-600 dark:text-ink-300">
                  {d.description}
                </p>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-500 dark:text-ink-400">
                  {d.notes}
                </p>
              </li>
            ))}
          </ul>

          {/* Friday weekly-update concept */}
          <div className="rounded-2xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-950/40">
            <h3 className="text-[13px] font-semibold tracking-tight text-ink-900 dark:text-ink-100">
              Friday weekly update — concept
            </h3>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-600 dark:text-ink-300">
              Each Friday morning the system would gather, per active loan, the approval /
              appraisal / title / insurance status, major outstanding conditions, the target
              closing date, the next milestone, and the last communication — then build clean
              draft updates for four audiences:
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {["Borrower", "Realtor", "Title", "Internal team"].map((a) => (
                <span
                  key={a}
                  className="rounded-md border border-ink-200 bg-ink-50/40 px-2 py-0.5 text-[11.5px] text-ink-700 dark:border-ink-700 dark:bg-ink-900/30 dark:text-ink-300"
                >
                  {a}
                </span>
              ))}
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-ink-500 dark:text-ink-400">
              Drafts only. Missing values render as &ldquo;Unknown&rdquo; — never guessed. Every
              draft waits for human review; nothing sends itself.
            </p>
          </div>

          {/* Webhook contract */}
          <div className="rounded-2xl border border-ink-200 bg-white p-4 dark:border-ink-800 dark:bg-ink-950/40">
            <h3 className="text-[13px] font-semibold tracking-tight text-ink-900 dark:text-ink-100">
              n8n webhook contract (documented · not activated)
            </h3>
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink-600 dark:text-ink-300">
              {WEBHOOK_CONTRACT_NOTE}
            </p>
            <p className="mt-2 font-mono text-[11.5px] text-ink-500 dark:text-ink-400">
              POST {PLANNED_WEBHOOK_PATH} <span className="opacity-70">(route not yet built)</span>
            </p>
          </div>
        </section>

        {/* Connector status */}
        <aside>
          <SourceConnectorStatus snapshot={snapshot} />
        </aside>
      </div>
    </div>
  );
}

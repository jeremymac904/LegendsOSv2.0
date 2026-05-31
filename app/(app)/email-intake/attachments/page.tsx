import { redirect } from "next/navigation";
import { FileText, Paperclip, ShieldAlert } from "lucide-react";

import { SectionHeader } from "@/components/ui/SectionHeader";
import {
  IntakeSubnav,
  MigrationNotice,
  PhaseOneBanner,
  PhaseTwoTag,
  SampleBadge,
} from "@/components/emailintake/shared";
import { cn, formatRelative } from "@/lib/utils";
import type { IntakeAttachment } from "@/lib/emailIntake/types";
import { getEffectiveProfile } from "@/lib/impersonation";
import { isAdminOrOwner } from "@/lib/permissions";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  pending_review:
    "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300",
  needs_review:
    "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-300",
  suspicious:
    "border-red-300 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300",
  approved:
    "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300",
  filed:
    "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300",
  rejected:
    "border-ink-200 bg-ink-50 text-ink-500 dark:border-ink-700 dark:bg-ink-800/40 dark:text-ink-400",
};

const STATUS_LABEL: Record<string, string> = {
  pending_review: "Pending review",
  needs_review: "Needs review",
  suspicious: "Suspicious",
  approved: "Approved",
  filed: "Filed",
  rejected: "Rejected",
};

const DRIVE_LABEL: Record<string, string> = {
  pending: "Pending",
  needs_review_folder: "Needs Review folder",
  borrower_folder: "Borrower folder",
  not_uploaded: "Not uploaded",
};

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function loadAttachments(): Promise<{
  ok: boolean;
  rows: IntakeAttachment[];
}> {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("email_intake_attachments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return { ok: false, rows: [] };
    return { ok: true, rows: (data ?? []) as IntakeAttachment[] };
  } catch {
    return { ok: false, rows: [] };
  }
}

export default async function EmailIntakeAttachmentsPage() {
  const { profile } = await getEffectiveProfile();
  if (!isAdminOrOwner(profile)) redirect("/dashboard");

  const { ok, rows } = await loadAttachments();
  const pendingCount = rows.filter((r) =>
    ["pending_review", "needs_review", "suspicious"].includes(r.status)
  ).length;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Email Intake"
        title="Attachment review queue"
        description="Files extracted from inbound mail. In Phase 1 nothing is uploaded or filed — every attachment lands in the Needs Review holding state for a human to vet before it touches any borrower folder."
        action={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-2.5 py-1 text-[11px] font-medium text-ink-600 dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-300">
            <Paperclip size={13} /> {pendingCount} awaiting review
          </span>
        }
      />

      <IntakeSubnav active="/email-intake/attachments" />

      <PhaseOneBanner />

      {/* Needs Review strategy note */}
      <div className="flex items-start gap-3 rounded-xl border border-ink-200 bg-white px-4 py-3 dark:border-ink-800 dark:bg-ink-950/40">
        <ShieldAlert
          size={16}
          className="mt-0.5 shrink-0 text-accent-gold"
        />
        <div className="text-[12.5px] leading-relaxed text-ink-600 dark:text-ink-300">
          <span className="font-semibold text-ink-900 dark:text-ink-100">
            Needs Review strategy.
          </span>{" "}
          Attachments are never auto-filed to a borrower folder. They are held
          in a{" "}
          <span className="font-medium text-ink-800 dark:text-ink-100">
            Needs Review
          </span>{" "}
          location and flagged{" "}
          <span className="font-medium text-ink-800 dark:text-ink-100">
            suspicious
          </span>{" "}
          when the type or sender looks risky. A human approves the loan match
          and destination before anything moves — that approval path is Phase 2.
        </div>
      </div>

      {!ok ? (
        <MigrationNotice surface="attachment queue" />
      ) : rows.length === 0 ? (
        <div className="card flex flex-col items-center justify-center gap-2 p-10 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full border border-ink-200 bg-ink-50 text-ink-400 dark:border-ink-800 dark:bg-ink-900/50 dark:text-ink-500">
            <FileText size={18} />
          </div>
          <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">
            No attachments recorded
          </p>
          <p className="max-w-md text-[12.5px] text-ink-600 dark:text-ink-300">
            When inbound mail carries files, each one is listed here with its
            review status and holding location.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-ink-200 dark:border-ink-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-ink-50 text-[10px] uppercase tracking-[0.14em] text-ink-500 dark:bg-ink-900/50 dark:text-ink-400">
              <tr>
                <th className="px-3 py-2 font-medium">File</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Size</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Location</th>
                <th className="px-3 py-2 font-medium">Received</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr
                  key={a.id}
                  className="border-t border-ink-200 bg-white hover:bg-ink-50 dark:border-ink-800 dark:bg-ink-950/40 dark:hover:bg-ink-900/40"
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <FileText
                        size={13}
                        className="shrink-0 text-ink-400 dark:text-ink-500"
                      />
                      <span className="truncate font-medium text-ink-900 dark:text-ink-100">
                        {a.file_name || "(unnamed file)"}
                      </span>
                      {a.is_sample && <SampleBadge />}
                    </div>
                    {a.status === "suspicious" && a.suspicious_reason && (
                      <p className="mt-0.5 text-[11px] text-red-600 dark:text-red-300">
                        {a.suspicious_reason}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-ink-500 dark:text-ink-400">
                    {a.mime_type || "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-[11px] text-ink-500 dark:text-ink-400">
                    {formatBytes(a.size_bytes)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        STATUS_TONE[a.status] ?? STATUS_TONE.pending_review
                      )}
                    >
                      {STATUS_LABEL[a.status] ?? a.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[12px] text-ink-700 dark:text-ink-200">
                    {a.drive_url ? (
                      <a
                        href={a.drive_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent-gold underline-offset-2 hover:underline"
                      >
                        {DRIVE_LABEL[a.drive_location] ?? a.drive_location}
                      </a>
                    ) : (
                      DRIVE_LABEL[a.drive_location] ?? a.drive_location
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-[11px] text-ink-500 dark:text-ink-400">
                    {formatRelative(a.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Honest note on absent file actions — no dead buttons. */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-500 dark:text-ink-400">
        <PhaseTwoTag />
        <span>
          File actions (approve, file to borrower folder, reject) are not enabled
          in Phase 1. They ship once the human-approval write path is live.
        </span>
      </div>
    </div>
  );
}

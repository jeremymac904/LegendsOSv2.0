"use client";

// =============================================================================
// DriveLinkPanel — Drive folder link placeholder per loan
// =============================================================================
// PLACEHOLDER UI — Drive URL is sourced from BoardRow.driveUrl (DB column
// loans.drive_url). In sample/demo mode this is null, so the button is
// disabled with a clear label.
//
// TODO (DB / integration):
//   - loans.drive_url must be populated (currently null for sample loans)
//   - Requires Google Drive OAuth connection (Settings → Integrations)
//   - When live, un-disable the anchor below; swap disabled <button> for <a>
//   - Consider adding sub-folder links:
//       drive_url_income, drive_url_assets, drive_url_conditions, etc.
//     These would be extra columns on the loans table or a loan_drive_folders
//     junction table.
// =============================================================================

import { FolderOpen, ExternalLink, AlertTriangle } from "lucide-react";
import type { BoardRow } from "@/lib/loanbrain/store";

export function DriveLinkPanel({ row }: { row: BoardRow }) {
  const hasUrl = Boolean(row.driveUrl);

  return (
    <div className="space-y-2">
      {!hasUrl && (
        <p className="flex items-center gap-1.5 rounded-lg border border-dashed border-ink-300/40 bg-ink-950/20 px-2.5 py-1 text-[11px] text-ink-400 dark:border-ink-700/40 dark:text-ink-500">
          <AlertTriangle size={11} className="shrink-0" />
          PLACEHOLDER — Drive URL not set. Populate loans.drive_url in DB or set via Settings → Integrations.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {/* Main Drive folder */}
        {hasUrl ? (
          <a
            href={row.driveUrl!}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost inline-flex items-center gap-1.5 text-xs"
          >
            <FolderOpen size={13} />
            Open Drive folder
            <ExternalLink size={11} />
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-ink-200/40 bg-ink-950/20 px-3 py-1.5 text-[12px] text-ink-400 dark:border-ink-800/40"
            title="Drive URL not set — requires loans.drive_url in DB"
          >
            <FolderOpen size={13} />
            Drive folder (not linked)
          </button>
        )}

        {/* Sub-folder placeholders — TODO: connect once loan_drive_folders table exists */}
        {(["Income & Assets", "Conditions", "Title & HOI", "Correspondence"] as const).map((label) => (
          <button
            key={label}
            type="button"
            disabled
            className="inline-flex cursor-not-allowed items-center gap-1 rounded-lg border border-ink-200/30 bg-ink-950/10 px-2.5 py-1 text-[11px] text-ink-400 dark:border-ink-800/30"
            title={`TODO: sub-folder link for "${label}" — requires loan_drive_folders table`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

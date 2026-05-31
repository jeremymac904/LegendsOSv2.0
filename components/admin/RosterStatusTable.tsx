"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  MinusCircle,
} from "lucide-react";

import { StatusPill } from "@/components/ui/StatusPill";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/database";

// Presentational checklist of the verified roster vs. live profiles. This
// component renders ONLY what the server already computed — it never fetches,
// never provisions, and never fakes a "connected" integration. The per-user
// integration columns (Gmail / Drive / Calendar / Zapier MCP / notifications)
// are NOT wired per-user yet, so every cell is honestly "setup needed".

export type RosterRowStatus =
  | "provisioned_active"
  | "provisioned_inactive"
  | "wrong_role"
  | "not_created";

// A fully serializable row. The server builds these from TEAM_ROSTER + the live
// `profiles` rows so nothing server-only crosses into the client bundle.
export interface RosterRow {
  /** Roster name (source of truth). */
  name: string;
  /** Canonical roster email. */
  email: string;
  /** Expected LegendsOS role from the roster. */
  expectedRole: UserRole;
  /** Human title from the roster (Loan Officer, Processor, ...). */
  title: string;
  /** Direct phone or null. */
  phone: string | null;
  /** Licensed states (USPS abbreviations). */
  states: string[];
  /** Live profile id, when a matching profile exists. */
  profileId: string | null;
  /** Live profile email (may differ in case / be an alt email). */
  profileEmail: string | null;
  /** Live full_name on the profile, used for completeness. */
  profileFullName: string | null;
  /** Live role on the profile, when provisioned. */
  liveRole: UserRole | null;
  /** Live is_active flag, when provisioned. */
  isActive: boolean | null;
  /** Computed overall status. */
  status: RosterRowStatus;
  /** True when provisioned and the live role matches the expected role. */
  roleMatches: boolean;
  /** True when the live profile has a non-empty full_name. */
  profileComplete: boolean;
}

const STATUS_META: Record<
  RosterRowStatus,
  { label: string; pill: "ok" | "warn" | "err" | "off"; Icon: typeof Circle }
> = {
  provisioned_active: {
    label: "Provisioned (active)",
    pill: "ok",
    Icon: CheckCircle2,
  },
  provisioned_inactive: {
    label: "Provisioned (inactive)",
    pill: "off",
    Icon: MinusCircle,
  },
  wrong_role: { label: "Wrong role", pill: "warn", Icon: AlertTriangle },
  not_created: { label: "Not created", pill: "err", Icon: Circle },
};

function roleLabel(role: UserRole | null): string {
  if (!role) return "—";
  return role === "loan_officer" ? "LO" : role;
}

// Per-user integration columns. These are intentionally honest: there is no
// per-user OAuth/connection wiring yet, so they all read "setup needed". When
// per-user connections land, swap the hard-coded label for the real status.
const INTEGRATION_COLUMNS = [
  "Gmail",
  "Drive",
  "Calendar",
  "Zapier MCP",
  "Notifications",
] as const;

interface Props {
  rows: RosterRow[];
  rosterCount: number;
  provisionedCount: number;
}

export function RosterStatusTable({
  rows,
  rosterCount,
  provisionedCount,
}: Props) {
  return (
    <section className="card-padded space-y-4">
      <div className="section-title">
        <div>
          <h2>Team setup checklist</h2>
          <p>
            One row per verified roster member. Per-user integrations (Gmail,
            Drive, Calendar, Zapier MCP, notifications) are not wired per person
            yet — they show their real state, never a fake &quot;connected&quot;.
          </p>
        </div>
        <StatusPill
          status={provisionedCount === rosterCount ? "ok" : "warn"}
          label={`${provisionedCount} of ${rosterCount} provisioned`}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-ink-200 dark:border-ink-800">
        <table className="w-full min-w-[1100px] text-left text-xs">
          <thead className="bg-ink-100/70 text-[10px] uppercase tracking-[0.16em] text-ink-600 dark:bg-ink-900/70 dark:text-ink-300">
            <tr>
              <th className="px-3 py-2">Member</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">States</th>
              <th className="px-3 py-2">Profile</th>
              {INTEGRATION_COLUMNS.map((c) => (
                <th key={c} className="px-3 py-2 whitespace-nowrap">
                  {c}
                </th>
              ))}
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const meta = STATUS_META[row.status];
              const Icon = meta.Icon;
              const isMissing = row.status === "not_created";
              return (
                <tr
                  key={row.email}
                  className={cn(
                    "border-t border-ink-200 align-top dark:border-ink-800",
                    isMissing && "bg-status-err/5"
                  )}
                >
                  <td className="px-3 py-2">
                    <p className="flex items-center gap-1.5 font-medium text-ink-900 dark:text-ink-100">
                      <Icon
                        size={13}
                        className={cn(
                          "shrink-0",
                          meta.pill === "ok" && "text-status-ok",
                          meta.pill === "warn" && "text-status-warn",
                          meta.pill === "err" && "text-status-err",
                          meta.pill === "off" && "text-status-off"
                        )}
                      />
                      {row.name}
                    </p>
                    <p className="text-[11px] text-ink-600 dark:text-ink-300">
                      {row.email}
                    </p>
                    {row.profileEmail &&
                      row.profileEmail.toLowerCase() !==
                        row.email.toLowerCase() && (
                        <p className="text-[10px] text-ink-500 dark:text-ink-400">
                          login: {row.profileEmail}
                        </p>
                      )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="chip">{row.title}</span>
                    <p className="mt-1 text-[10px] text-ink-600 dark:text-ink-300">
                      expected: {roleLabel(row.expectedRole)}
                    </p>
                    {row.liveRole ? (
                      <p
                        className={cn(
                          "text-[10px]",
                          row.roleMatches
                            ? "text-status-ok"
                            : "text-status-warn"
                        )}
                      >
                        live: {roleLabel(row.liveRole)}
                        {row.roleMatches ? " ✓" : " (mismatch)"}
                      </p>
                    ) : (
                      <p className="text-[10px] text-ink-500 dark:text-ink-400">
                        live: —
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-ink-700 dark:text-ink-200">
                    {row.phone ?? (
                      <span className="text-ink-500 dark:text-ink-400">
                        none on file
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-ink-700 dark:text-ink-200">
                    {row.states.length > 0 ? (
                      <span className="font-mono">{row.states.join(", ")}</span>
                    ) : (
                      <span className="text-ink-500 dark:text-ink-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {row.profileId ? (
                      <StatusPill
                        status={row.profileComplete ? "ok" : "warn"}
                        label={row.profileComplete ? "complete" : "no name"}
                      />
                    ) : (
                      <span className="text-ink-500 dark:text-ink-400">—</span>
                    )}
                  </td>
                  {INTEGRATION_COLUMNS.map((c) => (
                    <td key={c} className="px-3 py-2">
                      <StatusPill status="warn" label="setup needed" />
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <StatusPill status={meta.pill} label={meta.label} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-ink-600 dark:text-ink-300">
        Per-user integration columns are honest placeholders: LegendsOS does not
        yet hold a per-person Gmail / Drive / Calendar / Zapier / notification
        connection, so every cell reads &quot;setup needed&quot; until that
        wiring ships. Nothing here is faked as connected.
      </p>
    </section>
  );
}

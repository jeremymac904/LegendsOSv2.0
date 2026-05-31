"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  DownloadCloud,
  Eye,
  Info,
  Power,
  PowerOff,
  ShieldAlert,
  UserPlus,
} from "lucide-react";

import {
  RosterStatusTable,
  type RosterRow,
} from "@/components/admin/RosterStatusTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/database";

// Owner-only provisioning + onboarding console. This client component CALLS the
// existing owner-only route POST /api/admin/users via fetch — it never touches
// the service-role key (that lives only on the server route). Provisioning is
// MANUAL: nothing runs on mount; the owner clicks "Provision" / "Import all".
// Every add uses send_invite_email:false, so NO email is sent — the owner
// shares the returned setup link themselves.

// Assignable roles for the per-user <select>. `owner` is excluded — the server
// route rejects update_role -> owner (promotion goes through promote_owner()).
const ROLE_OPTIONS: { value: Exclude<UserRole, "owner">; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "loan_officer", label: "LO" },
  { value: "processor", label: "Processor" },
  { value: "coordinator", label: "Coordinator" },
  { value: "marketing", label: "Marketing" },
  { value: "viewer", label: "Viewer" },
];

// Provisioned-user summary the server hands down (already serializable). Used
// for the role <select>, activate/deactivate, and preview-as controls.
export interface ProvisionedUser {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
}

// Roles we want Jeremy to be able to preview. Owner is "you are here".
const PREVIEW_ROLES: { role: UserRole; label: string }[] = [
  { role: "loan_officer", label: "Loan Officer" },
  { role: "processor", label: "Processor (Ashley)" },
  { role: "coordinator", label: "Coordinator (Geraldine)" },
];

type ProvisionResult = {
  ok: boolean;
  message: string;
  invite_link?: string | null;
};

interface Props {
  rosterRows: RosterRow[];
  provisionedUsers: ProvisionedUser[];
  ownerProfileId: string;
  rosterCount: number;
}

export function TeamSetupClient({
  rosterRows,
  provisionedUsers,
  ownerProfileId,
  rosterCount,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // Per-email provisioning result (invite link + message live here).
  const [results, setResults] = useState<Record<string, ProvisionResult>>({});
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const missing = useMemo(
    () => rosterRows.filter((r) => r.status === "not_created"),
    [rosterRows]
  );
  const provisionedCount = rosterCount - missing.length;

  async function callUsers(
    body: Record<string, unknown>
  ): Promise<Record<string, unknown> | null> {
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) {
      return {
        ok: false,
        message:
          res.status === 401
            ? "Session expired — refresh and sign in again."
            : "Server returned a non-JSON response.",
      };
    }
    return (await res.json()) as Record<string, unknown>;
  }

  // Provision one missing roster member. Always send_invite_email:false so no
  // email is sent; we surface the returned invite_link for manual delivery.
  async function provisionOne(row: RosterRow): Promise<ProvisionResult> {
    const data = await callUsers({
      action: "add",
      email: row.email,
      full_name: row.name,
      role: row.expectedRole,
      send_invite_email: false,
    });
    if (!data || data.ok !== true) {
      return {
        ok: false,
        message:
          (data?.message as string) ??
          (data?.error as string) ??
          "Could not provision this user.",
      };
    }
    return {
      ok: true,
      message: `Provisioned ${row.email} as ${row.expectedRole}.`,
      invite_link: (data.invite_link as string | null) ?? null,
    };
  }

  function handleProvision(row: RosterRow) {
    setError(null);
    setInfo(null);
    setBusyEmail(row.email);
    startTransition(async () => {
      const result = await provisionOne(row);
      setResults((prev) => ({ ...prev, [row.email]: result }));
      setBusyEmail(null);
      if (result.ok) {
        setInfo(result.message);
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  }

  // Sequentially provision every missing member. Each one is non-emailing.
  function handleImportAll() {
    setError(null);
    setInfo(null);
    setImporting(true);
    startTransition(async () => {
      let okCount = 0;
      for (const row of missing) {
        setBusyEmail(row.email);
        // eslint-disable-next-line no-await-in-loop
        const result = await provisionOne(row);
        setResults((prev) => ({ ...prev, [row.email]: result }));
        if (result.ok) okCount += 1;
      }
      setBusyEmail(null);
      setImporting(false);
      setInfo(
        `Import complete — ${okCount} of ${missing.length} missing member${
          missing.length === 1 ? "" : "s"
        } provisioned (no email sent).`
      );
      router.refresh();
    });
  }

  function updateRole(userId: string, role: UserRole) {
    if (role === "owner") return;
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const data = await callUsers({
        action: "update_role",
        user_id: userId,
        role,
      });
      if (!data || data.ok !== true) {
        setError((data?.message as string) ?? "Could not update role.");
        return;
      }
      setInfo("Role updated.");
      router.refresh();
    });
  }

  function setActive(userId: string, isActive: boolean) {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const data = await callUsers({
        action: "set_active",
        user_id: userId,
        is_active: isActive,
      });
      if (!data || data.ok !== true) {
        setError((data?.message as string) ?? "Could not update status.");
        return;
      }
      setInfo(isActive ? "User reactivated." : "User deactivated.");
      router.refresh();
    });
  }

  function previewAs(userId: string) {
    setError(null);
    startTransition(async () => {
      // Impersonation lives at its own owner-only route — call it directly.
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({ user_id: userId }),
      });
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) {
        setError("Could not start preview — refresh and sign in again.");
        return;
      }
      const parsed = (await res.json()) as { ok?: boolean; message?: string };
      if (!parsed.ok) {
        setError(parsed.message ?? "Could not start preview.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  }

  // First active, non-owner user holding a role — the preview target.
  function previewTarget(role: UserRole): ProvisionedUser | null {
    return (
      provisionedUsers.find(
        (u) => u.role === role && u.is_active && u.id !== ownerProfileId
      ) ?? null
    );
  }

  return (
    <div className="space-y-6">
      {/* Honest, non-emailing provisioning banner */}
      <div className="rounded-2xl border border-accent-gold/30 bg-accent-gold/5 p-4 text-xs">
        <p className="flex items-center gap-2 font-medium text-accent-gold">
          <ShieldAlert size={14} />
          Provisioning creates accounts WITHOUT sending email.
        </p>
        <p className="mt-1 text-ink-700 dark:text-ink-200">
          Each &quot;Provision&quot; click creates the Supabase account with{" "}
          <code>send_invite_email:false</code> and returns a one-time setup link.
          No email (team or customer) is sent from here — you share the setup
          link yourself, and the user sets their own password.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-status-err/30 bg-status-err/10 px-3 py-2 text-xs text-status-err">
          {error}
        </p>
      )}
      {info && (
        <p className="rounded-lg border border-status-ok/30 bg-status-ok/10 px-3 py-2 text-xs text-status-ok">
          {info}
        </p>
      )}

      {/* Missing-member provisioning */}
      <section className="card-padded space-y-4">
        <div className="section-title">
          <div>
            <h2>Provision missing members</h2>
            <p>
              {missing.length === 0
                ? "Every verified roster member already has a profile. Nothing to provision."
                : `${missing.length} roster member${
                    missing.length === 1 ? " is" : "s are"
                  } in the roster but not yet provisioned. Provision them one at a time, or import all at once — no email is sent.`}
            </p>
          </div>
          {missing.length > 0 && (
            <button
              type="button"
              className="btn-primary"
              onClick={handleImportAll}
              disabled={isPending || importing}
            >
              <DownloadCloud size={14} />
              {importing
                ? "Importing…"
                : `Import all missing (no email)`}
            </button>
          )}
        </div>

        {missing.length === 0 ? (
          <p className="rounded-lg border border-status-ok/30 bg-status-ok/10 px-3 py-2 text-xs text-status-ok">
            All {rosterCount} verified members are provisioned.
          </p>
        ) : (
          <div className="grid gap-3">
            {missing.map((row) => {
              const result = results[row.email];
              const busy = busyEmail === row.email;
              return (
                <div
                  key={row.email}
                  className="rounded-xl border border-ink-200 bg-white/60 p-3 dark:border-ink-800 dark:bg-ink-900/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-900 dark:text-ink-100">
                        {row.name}
                      </p>
                      <p className="text-[11px] text-ink-600 dark:text-ink-300">
                        {row.email} · {row.title} ·{" "}
                        {row.expectedRole === "loan_officer"
                          ? "LO"
                          : row.expectedRole}
                      </p>
                    </div>
                    {result?.ok ? (
                      <StatusPill status="ok" label="provisioned" />
                    ) : (
                      <button
                        type="button"
                        className="btn-secondary h-8 px-3 text-[11px]"
                        onClick={() => handleProvision(row)}
                        disabled={isPending || importing}
                      >
                        <UserPlus size={13} />
                        {busy ? "Provisioning…" : "Provision (no email)"}
                      </button>
                    )}
                  </div>

                  {result && !result.ok && (
                    <p className="mt-2 rounded border border-status-err/30 bg-status-err/10 px-2 py-1 text-[11px] text-status-err">
                      {result.message}
                    </p>
                  )}

                  {result?.ok && (
                    <InviteLinkBlock
                      name={row.name}
                      inviteLink={result.invite_link ?? null}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Existing-user controls */}
      <section className="card-padded space-y-4">
        <div className="section-title">
          <div>
            <h2>Provisioned users</h2>
            <p>
              Change a role, activate/deactivate, or preview as that person. Role
              and status changes route through the owner-only server endpoint —
              your service key never reaches the browser.
            </p>
          </div>
          <StatusPill
            status={provisionedCount === rosterCount ? "ok" : "warn"}
            label={`${provisionedCount} of ${rosterCount}`}
          />
        </div>

        <div className="overflow-x-auto rounded-xl border border-ink-200 dark:border-ink-800">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-ink-100/70 text-[10px] uppercase tracking-[0.16em] text-ink-600 dark:bg-ink-900/70 dark:text-ink-300">
              <tr>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {provisionedUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-6 text-center text-ink-500 dark:text-ink-300"
                  >
                    No profiles yet.
                  </td>
                </tr>
              ) : (
                provisionedUsers.map((u) => {
                  const isSelf = u.id === ownerProfileId;
                  const isOwnerRow = u.role === "owner";
                  return (
                    <tr
                      key={u.id}
                      className="border-t border-ink-200 align-middle dark:border-ink-800"
                    >
                      <td className="px-3 py-2">
                        <p className="font-medium text-ink-900 dark:text-ink-100">
                          {u.full_name ?? u.email}
                        </p>
                        <p className="text-[11px] text-ink-600 dark:text-ink-300">
                          {u.email}
                        </p>
                      </td>
                      <td className="px-3 py-2">
                        {isSelf || isOwnerRow ? (
                          <span
                            className={cn("chip", isOwnerRow && "chip-ok")}
                          >
                            {u.role === "loan_officer" ? "LO" : u.role}
                          </span>
                        ) : (
                          <select
                            className="input h-8 py-0 text-xs"
                            defaultValue={u.role}
                            onChange={(e) =>
                              updateRole(u.id, e.target.value as UserRole)
                            }
                            disabled={isPending}
                          >
                            {ROLE_OPTIONS.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <StatusPill
                          status={u.is_active ? "ok" : "off"}
                          label={u.is_active ? "active" : "inactive"}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {!isSelf && !isOwnerRow && (
                            <>
                              <button
                                type="button"
                                className={cn(
                                  "btn-ghost p-1.5",
                                  u.is_active &&
                                    "text-status-err hover:bg-status-err/10"
                                )}
                                title={u.is_active ? "Deactivate" : "Reactivate"}
                                onClick={() => setActive(u.id, !u.is_active)}
                                disabled={isPending}
                              >
                                {u.is_active ? (
                                  <PowerOff size={14} />
                                ) : (
                                  <Power size={14} />
                                )}
                              </button>
                              <button
                                type="button"
                                className="btn-secondary h-8 px-2 text-[11px]"
                                title="Preview as user"
                                onClick={() => previewAs(u.id)}
                                disabled={isPending || !u.is_active}
                              >
                                <Eye size={13} />
                                Preview
                              </button>
                            </>
                          )}
                          {isSelf && (
                            <span className="text-[10px] text-ink-500 dark:text-ink-400">
                              you
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Preview-as role coverage */}
      <section className="card-padded space-y-4">
        <div className="section-title">
          <div>
            <h2>Preview as a role</h2>
            <p>
              Jump into how each persona sees LegendsOS. Previewing impersonates
              the first active user with that role — exit anytime from the gold
              banner. Database reads still run as you (UI preview only).
            </p>
          </div>
          <span className="chip-active">Owner tool</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="flex flex-col rounded-2xl border border-status-ok/30 bg-status-ok/10 p-3.5">
            <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">
              Owner
            </p>
            <p className="mt-1 flex-1 text-[12px] leading-relaxed text-ink-700 dark:text-ink-300">
              Jeremy — full command center, every operator surface.
            </p>
            <span className="mt-3 inline-flex items-center gap-1.5 self-start rounded-lg border border-status-ok/30 bg-status-ok/10 px-2.5 py-1.5 text-[11px] font-medium text-status-ok">
              <Check size={12} />
              You are here
            </span>
          </div>

          {PREVIEW_ROLES.map((entry) => {
            const target = previewTarget(entry.role);
            return (
              <div
                key={entry.role}
                className={cn(
                  "flex flex-col rounded-2xl border p-3.5",
                  target
                    ? "border-ink-200 bg-white/60 dark:border-ink-800 dark:bg-ink-900/40"
                    : "border-dashed border-ink-300 bg-white/30 dark:border-ink-700 dark:bg-ink-900/20"
                )}
              >
                <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">
                  {entry.label}
                </p>
                {target ? (
                  <p className="mt-1 flex-1 truncate text-[12px] text-ink-600 dark:text-ink-300">
                    {target.full_name ?? target.email}
                  </p>
                ) : (
                  <p className="mt-1 flex-1 text-[12px] leading-relaxed text-ink-600 dark:text-ink-300">
                    No active {entry.label.toLowerCase()} provisioned yet.
                  </p>
                )}
                <div className="mt-3">
                  {target ? (
                    <button
                      type="button"
                      className="btn-secondary h-8 w-full justify-center px-2.5 text-[11px]"
                      onClick={() => previewAs(target.id)}
                      disabled={isPending}
                    >
                      <Eye size={13} />
                      Preview as {entry.label}
                    </button>
                  ) : (
                    <div className="rounded-lg border border-status-warn/30 bg-status-warn/10 px-2.5 py-2 text-[11px] leading-snug text-status-warn">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Info size={12} />
                        Provision a {entry.label.toLowerCase()} to preview
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* The full roster status checklist */}
      <RosterStatusTable
        rows={rosterRows}
        rosterCount={rosterCount}
        provisionedCount={provisionedCount}
      />
    </div>
  );
}

// Setup-link + copyable invite message for a freshly provisioned member.
function InviteLinkBlock({
  name,
  inviteLink,
}: {
  name: string;
  inviteLink: string | null;
}) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);

  const message = inviteLink
    ? `You've been added to LegendsOS — set your password here: ${inviteLink}`
    : "";

  if (!inviteLink) {
    return (
      <p className="mt-2 rounded border border-status-warn/30 bg-status-warn/10 px-2 py-1 text-[11px] text-status-warn">
        Account created for {name}, but no setup link was returned. Use the
        password-reset flow in Users to generate one.
      </p>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-accent-gold/30 bg-accent-gold/5 p-2.5 text-[11px]">
      <p className="font-medium text-accent-gold">
        Setup link for {name} — share it yourself (no email was sent).
      </p>
      <div className="mt-1.5 flex items-center gap-2">
        <code className="flex-1 truncate rounded bg-ink-100/70 px-2 py-1 text-[10px] text-ink-800 dark:bg-ink-950/60 dark:text-ink-100">
          {inviteLink}
        </code>
        <button
          type="button"
          className="btn h-7 px-2 text-[10px]"
          onClick={() => {
            void navigator.clipboard.writeText(inviteLink);
            setCopiedLink(true);
            setTimeout(() => setCopiedLink(false), 1500);
          }}
        >
          {copiedLink ? <Check size={11} /> : <Copy size={11} />}
          {copiedLink ? "Copied" : "Copy setup link"}
        </button>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="flex-1 truncate text-ink-600 dark:text-ink-300">
          {message}
        </span>
        <button
          type="button"
          className="btn h-7 px-2 text-[10px]"
          onClick={() => {
            void navigator.clipboard.writeText(message);
            setCopiedMsg(true);
            setTimeout(() => setCopiedMsg(false), 1500);
          }}
        >
          {copiedMsg ? <Check size={11} /> : <Copy size={11} />}
          {copiedMsg ? "Copied" : "Copy invite message"}
        </button>
      </div>
    </div>
  );
}

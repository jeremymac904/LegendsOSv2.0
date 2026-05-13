"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  KeyRound,
  Pencil,
  Power,
  PowerOff,
  UserPlus,
  X,
} from "lucide-react";

import { StatusPill } from "@/components/ui/StatusPill";
import { cn, formatRelative } from "@/lib/utils";
import type { Profile, UserRole } from "@/types/database";

const ROLES: { value: UserRole; label: string; description: string }[] = [
  {
    value: "admin",
    label: "Admin",
    description: "Full app access except role / billing changes.",
  },
  {
    value: "loan_officer",
    label: "LO",
    description: "Loan officer — uses Atlas, social, image, knowledge.",
  },
  {
    value: "processor",
    label: "Processor",
    description: "Operations team — read-mostly across modules.",
  },
  {
    value: "marketing",
    label: "Marketing",
    description: "Owns social, email, image, audience tools.",
  },
  {
    value: "viewer",
    label: "Viewer",
    description: "Read-only — sees dashboards, no posting.",
  },
];

interface Props {
  ownerProfileId: string;
  users: Profile[];
}

export function UserManager({ ownerProfileId, users }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [linkInfo, setLinkInfo] = useState<{
    user_id: string;
    kind: "invite" | "reset";
    url: string;
  } | null>(null);

  async function post(body: Record<string, unknown>) {
    setError(null);
    setInfo(null);
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
      setError(
        res.status === 401
          ? "Session expired — refresh and sign in again."
          : "Server returned a non-JSON response."
      );
      return null;
    }
    const data = await res.json();
    if (!data.ok) {
      setError(data.message ?? data.error);
      return null;
    }
    return data;
  }

  function addUser(form: FormData) {
    const email = String(form.get("email") ?? "").trim();
    const full_name = String(form.get("full_name") ?? "").trim();
    const role = (String(form.get("role") ?? "loan_officer") as UserRole);
    if (!email) {
      setError("Email is required.");
      return;
    }
    startTransition(async () => {
      const data = await post({
        action: "add",
        email,
        full_name: full_name || null,
        role,
        send_invite_email: true,
      });
      if (!data) return;
      if (data.invite_link) {
        setLinkInfo({
          user_id: data.user.id,
          kind: "invite",
          url: data.invite_link,
        });
      }
      setInfo(`Added ${email} as ${role}.`);
      setShowAdd(false);
      router.refresh();
    });
  }

  function updateRole(user_id: string, role: UserRole) {
    startTransition(async () => {
      const data = await post({ action: "update_role", user_id, role });
      if (!data) return;
      setInfo("Role updated.");
      setEditingId(null);
      router.refresh();
    });
  }

  function toggleActive(user_id: string, is_active: boolean) {
    startTransition(async () => {
      const data = await post({ action: "set_active", user_id, is_active });
      if (!data) return;
      setInfo(is_active ? "User reactivated." : "User deactivated.");
      router.refresh();
    });
  }

  function resetPw(user_id: string) {
    startTransition(async () => {
      const data = await post({ action: "reset_password", user_id });
      if (!data) return;
      if (data.reset_link) {
        setLinkInfo({ user_id, kind: "reset", url: data.reset_link });
      }
      setInfo("Password reset link generated.");
    });
  }

  return (
    <section className="card-padded space-y-4">
      <div className="section-title">
        <div>
          <h2>Team members</h2>
          <p>
            Add, edit, reset, and deactivate users. Auth changes route through
            Supabase&apos;s Admin API on the server — your service role key
            never reaches the browser.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setShowAdd((v) => !v)}
        >
          <UserPlus size={14} />
          {showAdd ? "Cancel" : "Add user"}
        </button>
      </div>

      {showAdd && (
        <form
          className="rounded-2xl border border-accent-gold/30 bg-accent-gold/5 p-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            addUser(new FormData(e.currentTarget));
          }}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <label>
              <span className="label">Email</span>
              <input
                name="email"
                type="email"
                required
                className="input mt-1"
                placeholder="teammate@legendsmortgage.com"
              />
            </label>
            <label>
              <span className="label">Full name (optional)</span>
              <input name="full_name" className="input mt-1" />
            </label>
            <label>
              <span className="label">Role</span>
              <select name="role" className="input mt-1" defaultValue="loan_officer">
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-[11px] text-ink-300">
            Supabase will email a magic-link invite. If email isn&apos;t set up
            yet, copy the link that appears below after creation.
          </p>
          <button
            className="btn-primary"
            type="submit"
            disabled={isPending}
          >
            <UserPlus size={14} />
            Create user
          </button>
        </form>
      )}

      {linkInfo && (
        <LinkBanner
          info={linkInfo}
          onClose={() => setLinkInfo(null)}
        />
      )}

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

      <div className="overflow-hidden rounded-xl border border-ink-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-900/70 text-[10px] uppercase tracking-[0.18em] text-ink-300">
            <tr>
              <th className="px-3 py-2">Member</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Active</th>
              <th className="px-3 py-2">Last seen</th>
              <th className="px-3 py-2">Joined</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-6 text-center text-ink-300"
                >
                  No profiles yet.
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const isSelf = u.id === ownerProfileId;
                const isEditing = editingId === u.id;
                return (
                  <tr key={u.id} className="border-t border-ink-800 align-middle">
                    <td className="px-3 py-2">
                      <p className="font-medium text-ink-100">
                        {u.full_name ?? u.email}
                      </p>
                      <p className="text-xs text-ink-300">{u.email}</p>
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <select
                          className="input"
                          defaultValue={u.role}
                          onChange={(e) =>
                            updateRole(u.id, e.target.value as UserRole)
                          }
                          disabled={isPending}
                        >
                          {ROLES.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={cn(
                            "chip",
                            u.role === "owner" && "chip-ok"
                          )}
                        >
                          {u.role === "loan_officer" ? "LO" : u.role}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <StatusPill
                        status={u.is_active ? "ok" : "off"}
                        label={u.is_active ? "active" : "inactive"}
                      />
                    </td>
                    <td className="px-3 py-2 text-ink-300">
                      {formatRelative(u.last_seen_at)}
                    </td>
                    <td className="px-3 py-2 text-ink-300">
                      {formatRelative(u.created_at)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {!isSelf && u.role !== "owner" && (
                          <>
                            <button
                              type="button"
                              className="btn-ghost p-1.5"
                              title={isEditing ? "Done" : "Edit role"}
                              onClick={() =>
                                setEditingId(isEditing ? null : u.id)
                              }
                              disabled={isPending}
                            >
                              {isEditing ? (
                                <Check size={14} />
                              ) : (
                                <Pencil size={14} />
                              )}
                            </button>
                            <button
                              type="button"
                              className="btn-ghost p-1.5"
                              title="Send password reset"
                              onClick={() => resetPw(u.id)}
                              disabled={isPending}
                            >
                              <KeyRound size={14} />
                            </button>
                            <button
                              type="button"
                              className={cn(
                                "btn-ghost p-1.5",
                                u.is_active && "text-status-err hover:bg-status-err/10"
                              )}
                              title={u.is_active ? "Deactivate" : "Reactivate"}
                              onClick={() => toggleActive(u.id, !u.is_active)}
                              disabled={isPending}
                            >
                              {u.is_active ? (
                                <PowerOff size={14} />
                              ) : (
                                <Power size={14} />
                              )}
                            </button>
                            <ImpersonateButton userId={u.id} />
                          </>
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
      <p className="text-[11px] text-ink-300">
        Promoting a user to owner still goes through{" "}
        <code>select public.promote_owner(&apos;email&apos;)</code> from the
        Supabase SQL editor — this UI intentionally doesn&apos;t create new
        owners.
      </p>
    </section>
  );
}

function LinkBanner({
  info,
  onClose,
}: {
  info: { user_id: string; kind: "invite" | "reset"; url: string };
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-lg border border-accent-gold/40 bg-accent-gold/10 p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-accent-gold">
          {info.kind === "invite"
            ? "Invite link — share with the new user"
            : "Password reset link — share with the user"}
        </p>
        <button
          type="button"
          className="text-ink-300 hover:text-ink-100"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={12} />
        </button>
      </div>
      <p className="mt-1 text-ink-200">
        Magic link delivery happens automatically via Supabase. If the email
        doesn&apos;t arrive within a minute, copy this link manually:
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 truncate rounded bg-ink-950/60 px-2 py-1 text-[10px] text-ink-100">
          {info.url}
        </code>
        <button
          type="button"
          className="btn"
          onClick={() => {
            void navigator.clipboard.writeText(info.url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function ImpersonateButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn-ghost p-1.5"
      title="Preview the app as this user"
      onClick={() =>
        start(async () => {
          const res = await fetch("/api/admin/impersonate", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              accept: "application/json",
            },
            body: JSON.stringify({ user_id: userId }),
          });
          const ct = res.headers.get("content-type") ?? "";
          if (!ct.includes("application/json")) return;
          const data = await res.json();
          if (data.ok) {
            router.refresh();
          }
        })
      }
      disabled={pending}
    >
      {/* lucide doesn't have a great "view as" — use a clean eye glyph */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </button>
  );
}

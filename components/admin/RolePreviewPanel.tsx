"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  ClipboardList,
  Eye,
  ShieldCheck,
  UserCheck,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { Profile, UserRole } from "@/types/database";

// Role-level preview for the owner. The existing per-row "Preview as user"
// button impersonates one specific account; this panel lets Jeremy jump
// straight into the four operator personas (Owner, LO, Processor,
// Coordinator) by impersonating the first active user holding that role.
//
// When no user holds a role yet, we DO NOT fabricate a fake account — we show
// a clear setup notice telling Jeremy to provision one in the table above.
// Reaching /admin/users already requires the real owner session (the page
// redirects while impersonating), so this panel only ever renders for Jeremy.

interface RolePreviewTarget {
  role: UserRole;
  label: string;
  description: string;
  icon: LucideIcon;
}

const PREVIEW_ROLES: RolePreviewTarget[] = [
  {
    role: "owner",
    label: "Owner",
    description: "Jeremy — full command center, every operator surface.",
    icon: ShieldCheck,
  },
  {
    role: "loan_officer",
    label: "Loan Officer",
    description: "My Loans, Atlas, studios, knowledge — the LO daily view.",
    icon: Briefcase,
  },
  {
    role: "processor",
    label: "Processor",
    description: "Ashley — Processing (FLO) cockpit and draft tools.",
    icon: ClipboardList,
  },
  {
    role: "coordinator",
    label: "Coordinator",
    description: "Geraldine — follow-up board and escalation drafts.",
    icon: UserCheck,
  },
];

interface Props {
  ownerProfileId: string;
  users: Profile[];
}

export function RolePreviewPanel({ ownerProfileId, users }: Props) {
  const router = useRouter();
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // First active, non-owner-self account for each role.
  function targetFor(role: UserRole): Profile | null {
    return (
      users.find(
        (u) => u.role === role && u.is_active && u.id !== ownerProfileId
      ) ?? null
    );
  }

  function previewAs(role: UserRole, userId: string) {
    setError(null);
    setPendingRole(role);
    startTransition(async () => {
      try {
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
        const data = await res.json();
        if (!data.ok) {
          setError(data.message ?? "Could not start preview.");
          return;
        }
        router.push("/dashboard");
        router.refresh();
      } catch {
        setError("Could not start preview.");
      } finally {
        setPendingRole(null);
      }
    });
  }

  return (
    <section className="card-padded space-y-4">
      <div className="section-title">
        <div>
          <h2>Role preview</h2>
          <p>
            Jump straight into how each persona sees LegendsOS. Previewing
            impersonates the first active user with that role; exit anytime from
            the banner. Database reads still run as you — this is a UI preview.
          </p>
        </div>
        <span className="chip-active">Owner tool</span>
      </div>

      {error && (
        <p className="rounded-lg border border-status-err/30 bg-status-err/10 px-3 py-2 text-xs text-status-err">
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {PREVIEW_ROLES.map((entry) => {
          const Icon = entry.icon;
          const isOwnerCard = entry.role === "owner";
          const target = isOwnerCard ? null : targetFor(entry.role);
          const hasTarget = isOwnerCard || Boolean(target);
          const busy = pendingRole === entry.role && isPending;

          return (
            <div
              key={entry.role}
              className={cn(
                "flex flex-col rounded-2xl border p-3.5 backdrop-blur-sm transition",
                hasTarget
                  ? "border-accent-champagne/15 bg-ink-950/30"
                  : "border-dashed border-ink-700/70 bg-ink-950/20"
              )}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-xl border",
                    hasTarget
                      ? "border-accent-gold/30 bg-accent-gold/10 text-accent-champagne"
                      : "border-ink-700/70 bg-ink-900/40 text-ink-400"
                  )}
                >
                  <Icon size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-100">
                    {entry.label}
                  </p>
                  {!isOwnerCard && target && (
                    <p className="truncate text-[11px] text-ink-400">
                      {target.full_name ?? target.email}
                    </p>
                  )}
                </div>
              </div>

              <p className="mt-2.5 flex-1 text-[12px] leading-relaxed text-ink-300">
                {entry.description}
              </p>

              <div className="mt-3">
                {isOwnerCard ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-status-ok/30 bg-status-ok/10 px-2.5 py-1.5 text-[11px] font-medium text-status-ok">
                    <ShieldCheck size={12} />
                    You are here
                  </span>
                ) : target ? (
                  <button
                    type="button"
                    className="btn-secondary h-8 w-full justify-center px-2.5 text-[11px]"
                    onClick={() => previewAs(entry.role, target.id)}
                    disabled={isPending}
                  >
                    <Eye size={13} />
                    {busy ? "Starting…" : `Preview as ${entry.label}`}
                  </button>
                ) : (
                  <div className="rounded-lg border border-status-warn/30 bg-status-warn/10 px-2.5 py-2 text-[11px] leading-snug text-status-warn">
                    <span className="flex items-center gap-1.5 font-medium">
                      <UserPlus size={12} />
                      No {entry.label.toLowerCase()} user yet
                    </span>
                    <span className="mt-1 block text-status-warn/80">
                      Add one in the table below to preview this role. No demo
                      accounts are created automatically.
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

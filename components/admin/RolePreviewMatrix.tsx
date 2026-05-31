"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, ShieldCheck, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Profile, UserRole } from "@/types/database";

// The four operator personas the owner can preview. Owner = your own view
// (no impersonation needed). The other three drive the existing UI-level
// impersonation cookie via /api/admin/impersonate. Each persona maps to a
// real teammate profile when one exists; without a profile we honestly
// disable the preview button and explain why.
const PERSONAS: {
  role: UserRole;
  label: string;
  person: string | null;
  blurb: string;
}[] = [
  {
    role: "owner",
    label: "Owner",
    person: "You",
    blurb: "Full admin — every operator surface, settings, and billing.",
  },
  {
    role: "loan_officer",
    label: "Loan Officer",
    person: null,
    blurb: "Atlas, social, image, knowledge, and their own loans.",
  },
  {
    role: "processor",
    label: "Processor",
    person: "Ashley",
    blurb: "Sees loans assigned to her in Processing (FLO).",
  },
  {
    role: "coordinator",
    label: "Coordinator",
    person: "Geraldine",
    blurb: "Sees leads/loans assigned to her for follow-up.",
  },
];

interface Props {
  ownerProfileId: string;
  // Every member profile in the org, so we can resolve a real preview target
  // for each persona role.
  members: Pick<Profile, "id" | "full_name" | "email" | "role" | "is_active">[];
}

export function RolePreviewMatrix({ ownerProfileId, members }: Props) {
  const router = useRouter();
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // First active, non-owner member that holds the given role.
  function targetFor(role: UserRole) {
    return members.find(
      (m) => m.role === role && m.is_active && m.id !== ownerProfileId
    );
  }

  function preview(role: UserRole, userId: string) {
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
          setError(
            res.status === 401
              ? "Session expired — sign in again."
              : "Server returned a non-JSON response."
          );
          return;
        }
        const data = await res.json();
        if (!data.ok) {
          setError(data.message ?? data.error ?? "Could not start preview.");
          return;
        }
        router.push("/dashboard");
        router.refresh();
      } finally {
        setPendingRole(null);
      }
    });
  }

  return (
    <section className="card-padded space-y-3">
      <div className="section-title">
        <div>
          <h2 className="flex items-center gap-2 text-ink-900 dark:text-ink-100">
            <ShieldCheck size={15} className="text-accent-gold" />
            Role preview
          </h2>
          <p className="text-ink-600 dark:text-ink-300">
            Preview the app exactly as each persona sees it. This sets a
            UI-only impersonation cookie — database reads still run as you, so
            nothing is written under the wrong persona. Hit{" "}
            <strong>Stop</strong> in the top banner to return to your own view.
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-status-err/30 bg-status-err/10 px-3 py-2 text-xs text-status-err">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {PERSONAS.map((p) => {
          const isOwnerCard = p.role === "owner";
          const target = isOwnerCard ? undefined : targetFor(p.role);
          const hasTarget = isOwnerCard || Boolean(target);
          const busy = isPending && pendingRole === p.role;
          return (
            <div
              key={p.role}
              className="flex flex-col rounded-xl border border-ink-200 bg-white p-3 dark:border-ink-800 dark:bg-ink-900/40"
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "chip",
                    isOwnerCard && "chip-ok"
                  )}
                >
                  {p.label}
                </span>
                {p.person && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-ink-600 dark:text-ink-400">
                    <UserRound size={11} />
                    {p.person}
                  </span>
                )}
              </div>
              <p className="mt-2 flex-1 text-[11px] leading-relaxed text-ink-600 dark:text-ink-300">
                {p.blurb}
              </p>
              <div className="mt-3">
                {isOwnerCard ? (
                  <span className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-status-ok/30 bg-status-ok/10 px-2 py-1.5 text-[11px] font-medium text-status-ok">
                    <Eye size={12} />
                    Your current view
                  </span>
                ) : hasTarget && target ? (
                  <button
                    type="button"
                    className="btn-secondary h-8 w-full px-2 text-[11px]"
                    onClick={() => preview(p.role, target.id)}
                    disabled={isPending}
                    title={`Preview as ${target.full_name ?? target.email}`}
                  >
                    <Eye size={12} />
                    {busy
                      ? "Starting…"
                      : `Preview as ${p.person ?? p.label}`}
                  </button>
                ) : (
                  <span
                    className="inline-flex w-full cursor-not-allowed items-center justify-center gap-1 rounded-lg border border-ink-200 bg-ink-50 px-2 py-1.5 text-[11px] text-ink-500 dark:border-ink-800 dark:bg-ink-900/60 dark:text-ink-400"
                    title="No active user holds this role yet"
                  >
                    No {p.label.toLowerCase()} on the team
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-ink-500 dark:text-ink-400">
        Add or assign a teammate in the Users tab to enable a persona shown as
        unavailable above. You can also preview any individual directly from the
        Users table.
      </p>
    </section>
  );
}

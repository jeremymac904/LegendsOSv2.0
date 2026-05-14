"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, LogOut } from "lucide-react";

interface Props {
  /** Display name (full_name preferred, falls back to email). Optional;
   *  if omitted we fall back to `targetEmail`. */
  targetName?: string;
  targetEmail: string;
  targetRole: string;
}

// Renders a sticky gold-tinted banner across the top when the owner is in
// preview-as-user mode. Database reads still happen as the owner — RLS
// uses auth.uid() — so this is a UI-only preview. The "Stop" button hits
// /api/admin/impersonate which clears the cookie.
export function ImpersonationBanner({
  targetName,
  targetEmail,
  targetRole,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function stop() {
    start(async () => {
      await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({ user_id: null }),
      });
      router.refresh();
    });
  }

  const label = targetName || targetEmail;

  return (
    <div className="sticky top-0 z-50 border-b border-accent-gold/40 bg-gradient-to-r from-accent-gold/15 via-accent-gold/10 to-accent-gold/15 px-3 py-1.5 text-xs text-accent-gold shadow-glow backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-2">
        <Eye size={13} className="shrink-0" />
        <p className="flex-1 truncate text-ink-100">
          Previewing as{" "}
          <strong className="text-accent-gold">{label}</strong>{" "}
          <span className="text-ink-300">({targetRole})</span>. Click{" "}
          <strong className="text-accent-gold">Stop</strong> to return to your
          own view.
        </p>
        <button
          type="button"
          onClick={stop}
          disabled={pending}
          className="btn-primary inline-flex h-7 items-center gap-1 px-2.5 py-0 text-[11px] uppercase tracking-wider"
        >
          <LogOut size={12} />
          {pending ? "Stopping…" : "Stop"}
        </button>
      </div>
    </div>
  );
}

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";

interface Props {
  targetEmail: string;
  targetRole: string;
}

// Renders a sticky orange banner across the top when the owner is in
// preview-as-user mode. Writes still hit RLS as the owner, so the message
// makes clear this is a UI-only preview.
export function ImpersonationBanner({ targetEmail, targetRole }: Props) {
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

  return (
    <div className="sticky top-0 z-50 border-b border-status-warn/40 bg-status-warn/15 px-3 py-1.5 text-xs text-status-warn backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-2">
        <AlertTriangle size={13} className="shrink-0" />
        <p className="flex-1 truncate">
          Previewing as <strong>{targetEmail}</strong> ({targetRole}). The UI
          shows what they would see; database reads still run under your
          owner session.
        </p>
        <button
          type="button"
          onClick={stop}
          className="inline-flex items-center gap-1 rounded-md border border-status-warn/40 px-2 py-0.5 text-[11px] hover:bg-status-warn/20"
          disabled={pending}
        >
          <X size={11} />
          Stop preview
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

interface Props {
  provider: string;
  initialEnabled: boolean;
  // When false, the toggle is read-only (e.g. non-owner viewing).
  canEdit: boolean;
}

export function ProviderToggle({ provider, initialEnabled, canEdit }: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    if (!canEdit || isPending) return;
    const next = !enabled;
    setError(null);
    setEnabled(next);
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/providers", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ provider, enabled: next }),
        });
        const data = await res.json();
        if (!data.ok) {
          setError(data.message ?? data.error ?? "update failed");
          // revert
          setEnabled(!next);
          return;
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "update failed");
        setEnabled(!next);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={toggle}
        disabled={!canEdit || isPending}
        className={cn(
          "relative inline-flex h-5 w-10 items-center rounded-full border transition",
          enabled
            ? "border-status-ok/40 bg-status-ok/30"
            : "border-ink-700 bg-ink-800",
          (!canEdit || isPending) && "cursor-not-allowed opacity-60"
        )}
        title={
          canEdit
            ? enabled
              ? "Click to disable"
              : "Click to enable"
            : "Only the owner can change this"
        }
      >
        <span
          className={cn(
            "inline-block h-3.5 w-3.5 transform rounded-full bg-ink-100 transition",
            enabled ? "translate-x-5" : "translate-x-0.5"
          )}
        />
      </button>
      {error && (
        <span className="text-[10px] text-status-err">{error}</span>
      )}
    </div>
  );
}

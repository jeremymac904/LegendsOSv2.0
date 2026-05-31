"use client";

import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

// Honest verdict badge for a Jeremy AI Review result. Three states only.
export type VibeVerdict = "ship_it" | "tweak_first" | "rework";

const CONFIG: Record<
  VibeVerdict,
  { label: string; icon: typeof CheckCircle2; cls: string }
> = {
  ship_it: {
    label: "Ship it",
    icon: CheckCircle2,
    cls: "border-status-ok/40 bg-status-ok/10 text-status-ok",
  },
  tweak_first: {
    label: "Tweak first",
    icon: AlertTriangle,
    cls: "border-status-warn/40 bg-status-warn/10 text-status-warn",
  },
  rework: {
    label: "Rework",
    icon: XCircle,
    cls: "border-status-err/40 bg-status-err/10 text-status-err",
  },
};

export function VibeReviewBadge({ verdict }: { verdict: VibeVerdict }) {
  const c = CONFIG[verdict];
  const Icon = c.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
        c.cls
      )}
    >
      <Icon size={12} />
      {c.label}
    </span>
  );
}

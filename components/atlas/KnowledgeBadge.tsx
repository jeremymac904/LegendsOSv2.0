"use client";

import { CheckCircle2 } from "lucide-react";

interface KnowledgeBadgeProps {
  /** When true, render the badge. When false/undefined, render nothing. */
  used?: boolean | null;
  /** Optional count of sources for a more informative label. */
  count?: number | null;
}

/**
 * Tiny "Grounded in knowledge" chip. Surfaced next to the router chip so the
 * user can see at a glance that the assistant message was grounded by the
 * knowledge retrieval layer, not pulled from raw model parametric memory.
 */
export function KnowledgeBadge({ used, count }: KnowledgeBadgeProps) {
  if (!used) return null;
  const label =
    typeof count === "number" && count > 0
      ? `Grounded · ${count} source${count === 1 ? "" : "s"}`
      : "Grounded in knowledge";
  return (
    <span
      title="This reply was grounded by the knowledge retrieval layer."
      className="inline-flex items-center gap-1 rounded-full border border-accent-gold/30 bg-accent-gold/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-accent-gold backdrop-blur-sm"
    >
      <CheckCircle2 size={9} />
      {label}
    </span>
  );
}

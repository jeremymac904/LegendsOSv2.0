import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Small dark-gold-glass pill that marks a row created by Atlas (the
 * assistant) rather than by a human composer. Rendered next to drafts in
 * Social Studio and Email Studio whenever the row's metadata flag
 * `created_by_atlas === true` is set.
 *
 * The marker is purely informational — it does NOT change behaviour
 * downstream (no schedule, no dispatch, no audience). It just tells the
 * owner "Atlas filled this in for you; review before posting".
 */
export function AtlasBadge({
  className,
  title = "Created by Atlas — review before posting",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-full border border-accent-gold/35 bg-gradient-to-b from-accent-gold/15 to-accent-orange/10 px-2 text-[9px] font-medium uppercase tracking-[0.14em] text-accent-gold backdrop-blur-sm",
        className
      )}
    >
      <Sparkles size={9} aria-hidden />
      Atlas
    </span>
  );
}

// Type guard for the metadata flag. Centralised here so list views and
// detail pages all agree on the same predicate.
export function isAtlasCreated(
  metadata: Record<string, unknown> | null | undefined
): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  const flag = (metadata as { created_by_atlas?: unknown }).created_by_atlas;
  if (flag === true) return true;
  // Backward compat for drafts created before the explicit flag was added.
  const source = (metadata as { source?: unknown }).source;
  return source === "atlas_tool";
}

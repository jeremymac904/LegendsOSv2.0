import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";

import type { CurriculumModule } from "@/lib/legends/curriculum";
import { statusLabel } from "@/lib/legends/curriculum";

interface ModuleListItemProps {
  module: CurriculumModule;
  trackSlug: string;
}

/**
 * One module row on a Legends Academy track page.
 * Status badge clearly communicates Draft / Coming soon / Available.
 */
export function ModuleListItem({ module, trackSlug }: ModuleListItemProps) {
  const statusChipClass =
    module.status === "available"
      ? "chip-active"
      : module.status === "coming-soon"
        ? "chip-off"
        : "chip";

  return (
    <Link
      href={`/training/academy/${trackSlug}/${module.id}`}
      className="glass-card-padded group block transition-transform hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="label">
              {module.level === "track-only" ? "Mastery" : `Level ${module.level}`}
            </span>
            <span className={statusChipClass}>
              {statusLabel(module.status)}
            </span>
          </div>
          <h3 className="mt-2 text-base font-semibold text-ink-900 dark:text-ink-100">
            {module.title}
          </h3>
        </div>
        <ArrowRight
          size={16}
          className="mt-1 shrink-0 text-ink-600 transition-colors group-hover:text-accent-champagne dark:text-ink-400"
        />
      </div>
      <p className="mt-2 text-sm leading-relaxed text-ink-700 dark:text-ink-200">
        {module.summary}
      </p>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-ink-500 dark:text-ink-400">
        <Clock size={12} />
        <span>{module.durationMinutes} min</span>
      </div>
    </Link>
  );
}

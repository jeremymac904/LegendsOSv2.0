import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="card flex flex-col items-center justify-center gap-4 p-10 text-center">
      {Icon && (
        <div className="relative grid h-14 w-14 place-items-center">
          {/* Faint gold halo */}
          <span
            aria-hidden
            className="absolute inset-0 rounded-full bg-accent-gold/10 blur-[10px]"
          />
          <span
            aria-hidden
            className="absolute inset-1 rounded-full border border-accent-gold/25"
          />
          <span className="relative grid h-10 w-10 place-items-center rounded-full border border-accent-gold/30 bg-ink-900/70 text-accent-gold shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
            <Icon size={18} />
          </span>
        </div>
      )}
      <div className="space-y-1.5">
        <p className="text-[15px] font-semibold tracking-tight text-ink-100">
          {title}
        </p>
        {description && (
          <p className="mx-auto max-w-md text-[12.5px] leading-relaxed text-ink-300">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

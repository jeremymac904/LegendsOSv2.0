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
    <div className="card flex flex-col items-center justify-center gap-3 p-10 text-center">
      {Icon && (
        <div className="grid h-12 w-12 place-items-center rounded-2xl border border-ink-700 bg-ink-800/70 text-ink-300">
          <Icon size={18} />
        </div>
      )}
      <div>
        <p className="text-sm font-medium text-ink-100">{title}</p>
        {description && (
          <p className="mx-auto mt-1 max-w-md text-xs text-ink-300">
            {description}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

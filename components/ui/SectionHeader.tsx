interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: SectionHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && (
          <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-ink-400">
            <span
              aria-hidden
              className="inline-block h-px w-6 bg-gradient-to-r from-accent-gold/70 to-transparent"
            />
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1.5 text-[22px] font-semibold tracking-tight text-ink-100">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-ink-300">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className="flex flex-wrap items-center gap-2">{action}</div>
      )}
    </div>
  );
}

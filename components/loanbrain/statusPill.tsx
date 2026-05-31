import { cn } from "@/lib/utils";

// Map the blocked/working/done/seen status model (borrowed concept from herdr)
// onto the existing LegendsOS status palette. Uses the theme-aware chip-*
// helpers so pills read correctly in both light and dark mode.
const MAP: Record<
  string,
  { cls: string; dot: string; label: string }
> = {
  blocked: { cls: "chip-err", dot: "bg-status-err", label: "Blocked" },
  working: { cls: "chip-warn", dot: "bg-status-warn", label: "Working" },
  done: { cls: "chip-info", dot: "bg-status-info", label: "Done" },
  seen: { cls: "chip-ok", dot: "bg-status-ok", label: "Seen" },
};

export function StageStatusPill({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  const m = MAP[status] ?? { cls: "chip", dot: "bg-ink-400", label: status };
  return (
    <span className={m.cls}>
      <span aria-hidden className={cn("inline-block h-1.5 w-1.5 rounded-full", m.dot)} />
      {label ?? m.label}
    </span>
  );
}

const PRIORITY: Record<string, string> = {
  urgent: "chip-err",
  high: "chip-warn",
  normal: "chip",
  low: "chip-off",
};

export function PriorityPill({ priority }: { priority: string }) {
  return <span className={PRIORITY[priority] ?? "chip"}>{priority}</span>;
}

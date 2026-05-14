import { cn } from "@/lib/utils";
import type { ProviderStatus } from "@/types/database";

interface StatusPillProps {
  status: ProviderStatus | "ok" | "warn" | "err" | "info" | "off";
  label?: string;
}

export function StatusPill({ status, label }: StatusPillProps) {
  const tone: Record<string, string> = {
    ok: "chip-ok",
    configured: "chip-ok",
    info: "chip-info",
    warn: "chip-warn",
    err: "chip-err",
    error: "chip-err",
    off: "chip-off",
    disabled: "chip-off",
    missing: "chip-warn",
  };
  const dot: Record<string, string> = {
    ok: "bg-status-ok",
    configured: "bg-status-ok",
    info: "bg-status-info",
    warn: "bg-status-warn",
    err: "bg-status-err",
    error: "bg-status-err",
    off: "bg-status-off",
    disabled: "bg-status-off",
    missing: "bg-status-warn",
  };
  const fallback = "chip";
  const display = label ?? status;
  return (
    <span className={cn(tone[status] ?? fallback)}>
      <span
        aria-hidden
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full",
          dot[status] ?? "bg-ink-400"
        )}
      />
      {display}
    </span>
  );
}

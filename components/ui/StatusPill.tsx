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
  const fallback = "chip";
  const display = label ?? status;
  return <span className={cn(tone[status] ?? fallback)}>{display}</span>;
}

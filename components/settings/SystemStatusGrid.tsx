"use client";

import { useEffect, useState } from "react";
import {
  Bot,
  Database,
  HardDrive,
  KeyRound,
  Mail,
  Monitor,
  Palette,
  UserCog,
} from "lucide-react";

import { StatusPill } from "@/components/ui/StatusPill";
import { useTheme } from "@/components/ui/ThemeProvider";
import { cn } from "@/lib/utils";

type Tone = "ok" | "warn" | "info" | "off" | "missing";

interface ServerStatusItem {
  key: string;
  label: string;
  detail: string;
  tone: Tone;
  pill: string;
}

interface Props {
  /** Honest, server-computed statuses (Supabase, AI providers, n8n, role preview, email intake). */
  serverItems: ServerStatusItem[];
}

const ICONS: Record<string, typeof Database> = {
  supabase: Database,
  providers: KeyRound,
  n8n: Bot,
  role: UserCog,
  email: Mail,
};

/**
 * Honest, at-a-glance status grid. Server statuses (Supabase, AI providers,
 * n8n, role preview, email intake) are computed server-side and passed in.
 * Desktop-shell and theme are detected here on the client because the server
 * cannot know them — desktop uses the real `window.legendsosDesktop` marker
 * set by the Electron preload, and theme reads the live ThemeProvider value.
 * Nothing here shows "ready/connected" unless it is actually true.
 */
export function SystemStatusGrid({ serverItems }: Props) {
  const { theme } = useTheme();
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const desktop =
      typeof window !== "undefined" &&
      (window as unknown as { legendsosDesktop?: boolean }).legendsosDesktop ===
        true;
    setIsDesktop(desktop);
  }, []);

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {serverItems.map((item) => {
        const Icon = ICONS[item.key] ?? KeyRound;
        return (
          <StatusRow
            key={item.key}
            icon={<Icon size={15} />}
            label={item.label}
            detail={item.detail}
            tone={item.tone}
            pill={item.pill}
          />
        );
      })}

      {/* Desktop shell — detected live on the client, honest either way. */}
      <StatusRow
        icon={<Monitor size={15} />}
        label="Desktop app"
        detail={
          isDesktop === null
            ? "Detecting runtime…"
            : isDesktop
              ? "Running inside the LegendsOS desktop shell."
              : "Running in a web browser. Desktop is an optional download."
        }
        tone={isDesktop ? "ok" : "info"}
        pill={isDesktop === null ? "checking" : isDesktop ? "desktop" : "browser"}
      />

      {/* Theme — reads the live ThemeProvider value, not a guess. */}
      <StatusRow
        icon={<Palette size={15} />}
        label="Theme"
        detail={
          theme === "light"
            ? "Light mode is active for this browser."
            : "Dark mode is active for this browser."
        }
        tone="info"
        pill={theme === "light" ? "light" : "dark"}
      />

      {/* Drive Loan Brain has its own live tab; this is a pointer, not a fake state. */}
      <StatusRow
        icon={<HardDrive size={15} />}
        label="Google Drive Loan Brain"
        detail="Live connection status is in the Loan Brain tab. Read-only by design."
        tone="info"
        pill="see Loan Brain"
      />
    </div>
  );
}

function StatusRow({
  icon,
  label,
  detail,
  tone,
  pill,
}: {
  icon: React.ReactNode;
  label: string;
  detail: string;
  tone: Tone;
  pill: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-ink-200 bg-white px-3 py-2.5",
        "dark:border-accent-champagne/10 dark:bg-ink-950/30"
      )}
    >
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-ink-200 bg-ink-50 text-ink-600 dark:border-accent-champagne/20 dark:bg-accent-gold/10 dark:text-accent-champagne">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-ink-900 dark:text-ink-100">
            {label}
          </p>
          <StatusPill status={tone} label={pill} />
        </div>
        <p className="mt-0.5 text-xs leading-snug text-ink-600 dark:text-ink-400">
          {detail}
        </p>
      </div>
    </div>
  );
}

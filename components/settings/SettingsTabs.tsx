"use client";

import { useState } from "react";
import {
  Cable,
  KeyRound,
  Plug,
  ShieldCheck,
  User,
  Video,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type SettingsTabId =
  | "overview"
  | "connections"
  | "providers"
  | "loanbrain"
  | "mcp"
  | "tutorials";

interface TabDef {
  id: SettingsTabId;
  label: string;
  icon: typeof User;
}

const TABS: TabDef[] = [
  { id: "overview", label: "Overview", icon: User },
  { id: "connections", label: "Connections", icon: Cable },
  { id: "providers", label: "AI Providers", icon: KeyRound },
  { id: "loanbrain", label: "Loan Brain", icon: ShieldCheck },
  { id: "mcp", label: "MCP", icon: Plug },
  { id: "tutorials", label: "Tutorials & Branding", icon: Video },
];

interface Props {
  overview: React.ReactNode;
  connections: React.ReactNode;
  providers: React.ReactNode;
  loanbrain: React.ReactNode;
  mcp: React.ReactNode;
  tutorials: React.ReactNode;
}

/**
 * Compact tabbed shell for the Settings page. Keeps a single panel visible at
 * a time to cut vertical scroll while preserving every section. All panels are
 * rendered as children (server components passed down as React nodes), so this
 * client wrapper only owns the active-tab state — it never re-fetches anything.
 */
export function SettingsTabs({
  overview,
  connections,
  providers,
  loanbrain,
  mcp,
  tutorials,
}: Props) {
  const [active, setActive] = useState<SettingsTabId>("overview");

  const panels: Record<SettingsTabId, React.ReactNode> = {
    overview,
    connections,
    providers,
    loanbrain,
    mcp,
    tutorials,
  };

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Settings sections"
        className="flex flex-wrap gap-1.5 rounded-2xl border border-ink-200 bg-ink-50/60 p-1.5 dark:border-ink-800 dark:bg-ink-950/40"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(tab.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition",
                isActive
                  ? "bg-white text-ink-900 shadow-sm ring-1 ring-accent-champagne/30 dark:bg-ink-900 dark:text-ink-100"
                  : "text-ink-600 hover:bg-white/70 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-900/60 dark:hover:text-ink-100"
              )}
            >
              <Icon size={14} className={isActive ? "text-accent-gold" : undefined} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel">{panels[active]}</div>
    </div>
  );
}

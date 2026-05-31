"use client";

import { useEffect, useState } from "react";
import { MonitorCheck } from "lucide-react";

import { cn } from "@/lib/utils";

export interface DesktopState {
  isDesktop: boolean;
  platform: string;
  shellVersion: string;
}

export function readDesktopState(): DesktopState {
  if (typeof window === "undefined") {
    return { isDesktop: false, platform: "", shellVersion: "" };
  }
  const marker = window.legendsos;
  return {
    isDesktop: marker?.desktop === true,
    platform: marker?.platform ?? "",
    shellVersion: marker?.shellVersion ?? "",
  };
}

export function useDesktopState(): DesktopState {
  const [state, setState] = useState<DesktopState>(() => readDesktopState());

  useEffect(() => {
    const next = readDesktopState();
    setState(next);
  }, []);

  return state;
}

export function DesktopRuntime() {
  useEffect(() => {
    const state = readDesktopState();
    const root = document.documentElement;
    root.dataset.legendsosDesktop = state.isDesktop ? "true" : "false";
    root.dataset.legendsosPlatform = state.platform;
    root.dataset.legendsosShellVersion = state.shellVersion;
  }, []);

  return null;
}

export function DesktopStatusBadge({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { isDesktop, platform, shellVersion } = useDesktopState();
  if (!isDesktop) return null;

  const platformLabel =
    platform === "darwin"
      ? "Mac desktop"
      : platform === "win32"
      ? "Windows desktop"
      : "Desktop app";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-accent-champagne/25 bg-accent-gold/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent-orange dark:text-accent-champagne",
        className
      )}
      title={shellVersion ? `LegendsOS shell ${shellVersion}` : undefined}
    >
      <MonitorCheck size={compact ? 12 : 13} />
      {compact ? "Desktop" : platformLabel}
    </span>
  );
}

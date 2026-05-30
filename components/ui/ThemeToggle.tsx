"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/ui/ThemeProvider";

interface ThemeToggleProps {
  className?: string;
}

/**
 * Sun/Moon icon button. Flips between light and dark.
 * Used in TopBar; safe to mount anywhere underneath <ThemeProvider>.
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={
        className ??
        "btn-ghost px-2 py-2 text-ink-300 dark:text-ink-300"
      }
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Send } from "lucide-react";

import { cn } from "@/lib/utils";

// ───────────────────────────────────────────────────────────────────────────
// Send-to-Atlas contract.
//
// To hand a composed prompt to Atlas: write it to sessionStorage under the
// EXACT key "atlas:pendingPrompt" (plain string), then navigate to /atlas.
// The Atlas lane wires AtlasWorkspace to consume that key on mount. We always
// ALSO expose a "Copy prompt" button (navigator.clipboard) so the action is
// real even if sessionStorage / navigation is unavailable.
// ───────────────────────────────────────────────────────────────────────────

export const ATLAS_PENDING_PROMPT_KEY = "atlas:pendingPrompt";

export function writeAtlasPendingPrompt(prompt: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.sessionStorage.setItem(ATLAS_PENDING_PROMPT_KEY, prompt);
    return true;
  } catch {
    return false;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Build-log / prompt-history persistence (localStorage — genuinely real).
// ───────────────────────────────────────────────────────────────────────────

export interface PromptHistoryEntry {
  id: string;
  kind: string; // human label of the composer that produced it
  title: string;
  prompt: string;
  createdAt: string; // ISO
  action: "copied" | "sent-to-atlas";
}

export const BUILDER_HISTORY_KEY = "legendsos-builder-prompt-history";
const HISTORY_LIMIT = 100;

export interface BuilderProject {
  id: string;
  name: string;
  notes: string;
  createdAt: string;
}

export const BUILDER_PROJECTS_KEY = "legendsos-builder-projects";

// Generic localStorage-backed list hook. SSR-safe: starts empty, hydrates on
// mount, and persists on every change. Returns helpers tailored for lists.
export function useLocalStorageList<T extends { id: string }>(
  storageKey: string,
  limit?: number,
) {
  const [items, setItems] = useState<T[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setItems(parsed as T[]);
      }
    } catch {
      // Corrupt value — ignore and start clean.
    }
    setHydrated(true);
  }, [storageKey]);

  const persist = useCallback(
    (next: T[]) => {
      setItems(next);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Quota or privacy mode — state still updates in memory.
      }
    },
    [storageKey],
  );

  const add = useCallback(
    (item: T) => {
      persist(limit ? [item, ...items].slice(0, limit) : [item, ...items]);
    },
    [items, persist, limit],
  );

  const remove = useCallback(
    (id: string) => {
      persist(items.filter((i) => i.id !== id));
    },
    [items, persist],
  );

  const clear = useCallback(() => persist([]), [persist]);

  return { items, add, remove, clear, hydrated, persist };
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ───────────────────────────────────────────────────────────────────────────
// Shared UI primitives (on the LIGHT spec — dual ink pattern everywhere).
// ───────────────────────────────────────────────────────────────────────────

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && (
        <span className="mt-1 block text-[10.5px] leading-snug text-ink-600 dark:text-ink-400">
          {hint}
        </span>
      )}
    </label>
  );
}

export function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement>,
) {
  return <input {...props} className={cn("input mt-1", props.className)} />;
}

export function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return (
    <textarea
      {...props}
      className={cn(
        "input mt-1 min-h-[80px] resize-y leading-relaxed",
        props.className,
      )}
    />
  );
}

// Copy-to-clipboard button. Always works (clipboard API), shows transient
// confirmation, and records to history when an onRecord callback is given.
export function CopyButton({
  getText,
  disabled,
  label = "Copy prompt",
  className,
  onCopied,
}: {
  getText: () => string;
  disabled?: boolean;
  label?: string;
  className?: string;
  onCopied?: () => void;
}) {
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function handle() {
    const text = getText();
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Older browsers: fall back to a hidden textarea.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* nothing more we can do */
      }
      document.body.removeChild(ta);
    }
    setDone(true);
    onCopied?.();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDone(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={disabled}
      className={cn("btn-secondary", className)}
    >
      {done ? <Check size={14} /> : <Copy size={14} />}
      {done ? "Copied" : label}
    </button>
  );
}

// Send-to-Atlas button. Writes the contract key then navigates to /atlas.
export function SendToAtlasButton({
  getText,
  disabled,
  className,
  onSent,
}: {
  getText: () => string;
  disabled?: boolean;
  className?: string;
  onSent?: () => void;
}) {
  const router = useRouter();
  function handle() {
    const text = getText();
    if (!text.trim()) return;
    const ok = writeAtlasPendingPrompt(text);
    onSent?.();
    if (ok) router.push("/atlas");
  }
  return (
    <button
      type="button"
      onClick={handle}
      disabled={disabled}
      className={cn("btn-primary", className)}
    >
      <Send size={14} />
      Send to Atlas
    </button>
  );
}

// Read-only preview block for a composed prompt.
export function PromptPreview({ text }: { text: string }) {
  return (
    <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-ink-200 dark:border-ink-800 bg-ink-100/60 dark:bg-ink-950/50 p-3 text-[11.5px] leading-relaxed text-ink-800 dark:text-ink-200 scrollbar-thin">
      {text.trim() ? text : "Fill in the fields above to compose a prompt."}
    </pre>
  );
}

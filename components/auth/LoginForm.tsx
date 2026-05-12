"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";

type Mode = "sign_in" | "magic_link";

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const disabled = !isSupabaseConfigured();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (disabled) {
      setError("Supabase is not configured.");
      return;
    }
    startTransition(async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        if (mode === "sign_in") {
          const { error: err } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (err) {
            setError(err.message);
            return;
          }
          router.push(redirectTo);
          router.refresh();
        } else {
          const { error: err } = await supabase.auth.signInWithOtp({
            email,
            options: {
              emailRedirectTo:
                typeof window !== "undefined"
                  ? `${window.location.origin}/auth/callback`
                  : undefined,
            },
          });
          if (err) {
            setError(err.message);
            return;
          }
          setInfo("Check your email for a magic link.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Sign in failed");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="email" className="label">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={disabled || isPending}
          placeholder="you@mcdonald-mtg.com"
        />
      </div>
      {mode === "sign_in" && (
        <div className="space-y-1">
          <label htmlFor="password" className="label">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={disabled || isPending}
            placeholder="••••••••"
          />
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-status-err/30 bg-status-err/10 px-3 py-2 text-xs text-status-err">
          {error}
        </p>
      )}
      {info && (
        <p className="rounded-xl border border-status-ok/30 bg-status-ok/10 px-3 py-2 text-xs text-status-ok">
          {info}
        </p>
      )}

      <button type="submit" className="btn-primary w-full" disabled={disabled || isPending}>
        {isPending ? "Signing in…" : mode === "sign_in" ? "Sign in" : "Send magic link"}
      </button>

      <button
        type="button"
        className="btn-ghost w-full text-xs text-ink-300"
        onClick={() => {
          setMode(mode === "sign_in" ? "magic_link" : "sign_in");
          setError(null);
          setInfo(null);
        }}
        disabled={isPending}
      >
        {mode === "sign_in"
          ? "Use email magic link instead"
          : "Use password instead"}
      </button>
    </form>
  );
}

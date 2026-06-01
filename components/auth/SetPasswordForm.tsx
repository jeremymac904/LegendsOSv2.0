"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, KeyRound, ShieldAlert } from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";

// Where the setup / recovery link lands. Supabase verifies the token in the
// link and redirects here with the session (implicit flow tokens in the URL
// hash, which the browser client auto-detects on load). Once a session exists,
// the user picks a password via supabase.auth.updateUser({ password }).
//
// This form NEVER touches the service-role key — it only uses the public
// browser client, exactly like LoginForm. It is reachable WITHOUT being signed
// in because /auth/* is a public path in middleware.

const MIN_LENGTH = 8;

type SessionState = "checking" | "ready" | "no_session";

export function SetPasswordForm() {
  const [sessionState, setSessionState] = useState<SessionState>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  const configured = isSupabaseConfigured();

  // Detect whether the recovery / magic link established a session. The browser
  // client parses the URL hash on construction; we also listen for the
  // PASSWORD_RECOVERY / SIGNED_IN events in case it arrives a tick later.
  useEffect(() => {
    if (!configured) {
      setSessionState("no_session");
      return;
    }
    let active = true;
    const supabase = getSupabaseBrowserClient();

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSessionState(data.session ? "ready" : "no_session");
      })
      .catch(() => {
        if (active) setSessionState("no_session");
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session) setSessionState("ready");
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [configured]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!configured) {
      setError("Supabase is not configured.");
      return;
    }
    if (password.length < MIN_LENGTH) {
      setError(`Password must be at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    startTransition(async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { error: err } = await supabase.auth.updateUser({ password });
        if (err) {
          setError(err.message);
          return;
        }
        setDone(true);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not set your password."
        );
      }
    });
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-status-ok/30 bg-status-ok/10 text-status-ok">
          <CheckCircle2 size={22} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-ink-900 dark:text-ink-100">
            Password set
          </h2>
          <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
            Your account is ready. You&apos;re signed in.
          </p>
        </div>
        <Link href="/dashboard" className="btn-primary w-full justify-center">
          Go to your dashboard
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {!configured && (
        <div className="rounded-xl border border-status-warn/30 bg-status-warn/10 p-3 text-xs text-status-warn">
          Supabase is not configured, so passwords can&apos;t be set here yet.
        </div>
      )}

      {configured && sessionState === "checking" && (
        <p className="rounded-xl border border-ink-200 bg-ink-100/50 px-3 py-2 text-xs text-ink-600 dark:border-ink-800 dark:bg-ink-900/40 dark:text-ink-300">
          Verifying your setup link…
        </p>
      )}

      {configured && sessionState === "no_session" && (
        <div className="rounded-xl border border-status-warn/30 bg-status-warn/10 p-3 text-xs text-status-warn">
          <p className="flex items-center gap-1.5 font-medium">
            <ShieldAlert size={13} />
            This setup link isn&apos;t active.
          </p>
          <p className="mt-1 leading-relaxed">
            Open the most recent setup link Jeremy shared with you, or ask the
            owner to generate a fresh one. Links can expire or be used only once.
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="new-password" className="field-label">
          New password
        </label>
        <input
          id="new-password"
          type="password"
          required
          autoComplete="new-password"
          minLength={MIN_LENGTH}
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={!configured || sessionState !== "ready" || isPending}
          placeholder="At least 8 characters"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="confirm-password" className="field-label">
          Confirm password
        </label>
        <input
          id="confirm-password"
          type="password"
          required
          autoComplete="new-password"
          minLength={MIN_LENGTH}
          className="input"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={!configured || sessionState !== "ready" || isPending}
          placeholder="Re-enter your password"
        />
      </div>

      {error && (
        <p className="rounded-xl border border-status-err/30 bg-status-err/10 px-3 py-2 text-xs text-status-err">
          {error}
        </p>
      )}

      <button
        type="submit"
        className="btn-primary w-full justify-center py-2.5 text-sm"
        disabled={!configured || sessionState !== "ready" || isPending}
      >
        <KeyRound size={14} />
        {isPending ? "Setting password…" : "Set password & continue"}
      </button>

      <p className="text-center text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
        Already have a password?{" "}
        <Link href="/login" className="underline hover:text-accent-gold">
          Sign in
        </Link>
        .
      </p>
    </form>
  );
}

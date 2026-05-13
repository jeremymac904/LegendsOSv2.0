import Link from "next/link";
import { PlayCircle } from "lucide-react";

import { LoginForm } from "@/components/auth/LoginForm";
import { PUBLIC_ENV, isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { from?: string; error?: string; message?: string };
}) {
  // When NEXT_PUBLIC_WELCOME_VIDEO_URL is set, we render an embedded video
  // in the left pane. Otherwise we show a clean placeholder card. No more
  // "feature bullets" — Jeremy explicitly removed those from the sign-in
  // page in the walkthrough.
  const welcomeVideoUrl = process.env.NEXT_PUBLIC_WELCOME_VIDEO_URL || "";

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="hidden lg:flex flex-col justify-between border-r border-ink-800 bg-ember-radial p-12">
        <div>
          <div className="flex items-center gap-3">
            <Logo />
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-ink-300">
                {PUBLIC_ENV.APP_NAME}
              </p>
              <p className="text-sm text-ink-200">v2.0 · internal</p>
            </div>
          </div>
          <h1 className="mt-10 max-w-md text-3xl font-semibold leading-tight text-ink-100">
            One command center for{" "}
            <span className="bg-gradient-to-r from-accent-gold to-accent-orange bg-clip-text text-transparent">
              The Legends Mortgage Team
            </span>
            .
          </h1>
        </div>
        <div className="mt-6 max-w-md">
          {welcomeVideoUrl ? (
            <div className="aspect-video overflow-hidden rounded-2xl border border-ink-800 bg-ink-950 shadow-card">
              <iframe
                src={welcomeVideoUrl}
                title="LegendsOS welcome"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          ) : (
            <div className="card flex aspect-video flex-col items-center justify-center gap-2 p-6 text-center text-ink-300">
              <PlayCircle size={28} className="text-accent-gold" />
              <p className="text-sm font-medium text-ink-100">
                Welcome video coming soon
              </p>
              <p className="text-xs text-ink-300">
                Drop the URL into <code>NEXT_PUBLIC_WELCOME_VIDEO_URL</code>{" "}
                and it embeds here automatically.
              </p>
            </div>
          )}
        </div>
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <p className="label">Sign in</p>
          <h2 className="mt-1 text-2xl font-semibold text-ink-100">
            Welcome back
          </h2>
          <p className="mt-2 text-sm text-ink-300">
            Use your team email and password. The owner email{" "}
            <span className="font-medium text-ink-100">
              {PUBLIC_ENV.OWNER_EMAIL}
            </span>{" "}
            is provisioned with the owner role automatically.
          </p>
          {!isSupabaseConfigured() && (
            <div className="mt-4 rounded-xl border border-status-warn/30 bg-status-warn/10 p-3 text-xs text-status-warn">
              Supabase is not configured.{" "}
              <Link className="underline" href="/setup">
                Open setup
              </Link>{" "}
              to add environment variables.
            </div>
          )}
          {searchParams.error && (
            <div className="mt-4 rounded-xl border border-status-err/30 bg-status-err/10 p-3 text-xs text-status-err">
              {decodeURIComponent(searchParams.error)}
            </div>
          )}
          {searchParams.message && (
            <div className="mt-4 rounded-xl border border-status-info/30 bg-status-info/10 p-3 text-xs text-status-info">
              {decodeURIComponent(searchParams.message)}
            </div>
          )}
          <div className="mt-6">
            <LoginForm redirectTo={searchParams.from ?? "/dashboard"} />
          </div>
          <p className="mt-8 text-center text-xs text-ink-300">
            Need an account? Ask Jeremy to invite you — team members are
            provisioned by the owner only.
          </p>
        </div>
      </section>
    </main>
  );
}

function Logo() {
  return (
    <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-accent-gold via-accent-gold to-accent-orange text-base font-black text-ink-950 shadow-glow">
      L
    </div>
  );
}

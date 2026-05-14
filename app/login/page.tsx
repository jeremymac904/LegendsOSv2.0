import Link from "next/link";
import { Apple, Download, MonitorDown, PlayCircle } from "lucide-react";

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
  const macDownloadUrl =
    process.env.NEXT_PUBLIC_DESKTOP_MAC_DOWNLOAD_URL || "";
  const winDownloadUrl =
    process.env.NEXT_PUBLIC_DESKTOP_WINDOWS_DOWNLOAD_URL || "";

  return (
    <main className="relative grid min-h-screen bg-ember-radial lg:grid-cols-[1.05fr_1fr]">
      {/* Page-wide ambient gold wash. Stays restrained. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_-10%,rgba(245,180,0,0.10),transparent_60%)]"
      />
      <section className="hidden lg:flex flex-col border-r border-ink-800/70 px-12 py-10">
        <div className="flex items-center gap-3">
          <Logo />
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-ink-400">
              {PUBLIC_ENV.APP_NAME}
            </p>
            <p className="text-sm text-ink-200">v2.0 · internal</p>
          </div>
        </div>
        {/* Centered content block: headline → video → desktop downloads. */}
        <div className="flex flex-1 flex-col justify-center gap-8 pb-4">
          <h1 className="max-w-md text-3xl font-semibold leading-tight tracking-tight text-ink-100">
            One command center for{" "}
            <span className="bg-gradient-to-r from-accent-gold to-accent-orange bg-clip-text text-transparent">
              The Legends Mortgage Team
            </span>
            .
          </h1>
          <div className="w-full max-w-md">
            {welcomeVideoUrl ? (
              <div className="aspect-video overflow-hidden rounded-2xl border border-ink-800/80 bg-ink-950 shadow-card">
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
                <p className="text-xs text-ink-400">
                  Drop the URL into{" "}
                  <code className="text-accent-gold/90">
                    NEXT_PUBLIC_WELCOME_VIDEO_URL
                  </code>{" "}
                  and it embeds here automatically.
                </p>
              </div>
            )}
          </div>
          <DesktopDownloadCard
            macUrl={macDownloadUrl}
            winUrl={winDownloadUrl}
          />
        </div>
      </section>

      <section className="relative flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Centered wordmark above the form — small but present. */}
          <div className="mb-7 flex flex-col items-center gap-3 lg:hidden">
            <Logo />
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-gold-gradient">
              LegendsOS
            </p>
          </div>

          <div className="card-padded relative overflow-hidden p-7">
            <p className="label">Sign in</p>
            <h2 className="mt-1 text-[22px] font-semibold tracking-tight text-ink-100">
              Welcome back
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-300">
              Your command center awaits. Use your team email and password —
              owner email{" "}
              <span className="font-medium text-ink-100">
                {PUBLIC_ENV.OWNER_EMAIL}
              </span>{" "}
              is provisioned automatically.
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
          </div>

          <p className="mt-6 text-center text-[11px] leading-relaxed text-ink-400">
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
    <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-accent-gold via-accent-gold to-accent-orange text-base font-black text-ink-950 shadow-glow">
      L
      <span
        aria-hidden
        className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-accent-gold shadow-[0_0_8px_rgba(245,180,0,0.85)]"
      />
    </div>
  );
}

function DesktopDownloadCard({
  macUrl,
  winUrl,
}: {
  macUrl: string;
  winUrl: string;
}) {
  return (
    <div className="card w-full max-w-md p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-accent-gold/30 bg-accent-gold/10 text-accent-gold">
          <Download size={16} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight text-ink-100">
            Download LegendsOS Desktop
          </p>
          <p className="mt-0.5 text-xs text-ink-400">
            Use LegendsOS from your Mac or Windows desktop.
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <DesktopButton
          href={macUrl}
          label="Download for Mac"
          icon={<Apple size={14} />}
        />
        <DesktopButton
          href={winUrl}
          label="Download for Windows"
          icon={<MonitorDown size={14} />}
          variant="ghost"
        />
      </div>
    </div>
  );
}

function DesktopButton({
  href,
  label,
  icon,
  variant = "primary",
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  variant?: "primary" | "ghost";
}) {
  const baseClasses =
    variant === "primary"
      ? "btn-primary w-full justify-center"
      : "btn-secondary w-full justify-center";
  if (!href) {
    return (
      <button
        type="button"
        disabled
        className={`${baseClasses} cursor-not-allowed opacity-50`}
        title="Set the matching NEXT_PUBLIC_DESKTOP_*_DOWNLOAD_URL env var to enable."
      >
        {icon}
        <span>Coming soon</span>
      </button>
    );
  }
  return (
    <a href={href} className={baseClasses} target="_blank" rel="noreferrer">
      {icon}
      {label}
    </a>
  );
}

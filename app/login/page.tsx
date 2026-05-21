import { existsSync } from "node:fs";
import path from "node:path";

import Link from "next/link";
import { Apple, Download, MonitorDown, PlayCircle } from "lucide-react";

import { LoginForm } from "@/components/auth/LoginForm";
import { PUBLIC_ENV, isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

// Conventional names for the downloaded installer artifacts. If env URLs
// are not set, the login page falls back to /downloads/<name> when the
// file actually exists in public/downloads/. Both layers are optional —
// if neither is configured for a platform, the matching button shows
// "Test build pending" and is disabled.
const MAC_LOCAL_FILE = "LegendsOS.dmg";
const WIN_LOCAL_FILE = "LegendsOS-Setup.exe";

function resolveDownloadHref(args: {
  envUrl: string;
  localFile: string;
}): string {
  const { envUrl, localFile } = args;
  if (envUrl) return envUrl;
  // Server-side check for a locally-hosted artifact under public/downloads/.
  // If the file isn't present, return empty so the UI renders the disabled
  // "pending" state cleanly.
  try {
    const localPath = path.join(process.cwd(), "public", "downloads", localFile);
    if (existsSync(localPath)) {
      return `/downloads/${localFile}`;
    }
  } catch {
    // fs not available (edge runtime) — fall through
  }
  return "";
}

// Shell version is informational only. Bump alongside electron/main.cjs
// when the desktop wrapper itself ships a meaningful change.
const DESKTOP_SHELL_VERSION = "1.0.0";

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
  const macDownloadUrl = resolveDownloadHref({
    envUrl: process.env.NEXT_PUBLIC_DESKTOP_MAC_DOWNLOAD_URL || "",
    localFile: MAC_LOCAL_FILE,
  });
  const winDownloadUrl = resolveDownloadHref({
    envUrl: process.env.NEXT_PUBLIC_DESKTOP_WINDOWS_DOWNLOAD_URL || "",
    localFile: WIN_LOCAL_FILE,
  });

  return (
    <main className="relative min-h-screen overflow-hidden bg-ink-950">
      <img
        src="/assets/backgrounds/command-center-futuristic.jpg"
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover opacity-45"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(5,6,10,0.86),rgba(5,6,10,0.54)_48%,rgba(5,6,10,0.88)),radial-gradient(65%_55%_at_30%_12%,rgba(155,104,40,0.18),transparent_62%)]"
      />
      <div className="relative grid min-h-screen items-center gap-10 px-6 py-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-14 xl:px-20">
        <section className="hidden min-h-[720px] w-full max-w-[680px] flex-col justify-center lg:flex">
          <div className="mb-10 flex flex-col gap-5">
            <Logo />
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-accent-champagne/80">
                {PUBLIC_ENV.APP_NAME}
              </p>
              <h1 className="mt-3 max-w-2xl text-5xl font-semibold leading-[1.04] tracking-tight text-ink-100">
                The AI command center for{" "}
                <span className="text-gold-gradient gold-shimmer">
                  The Legends Mortgage Team
                </span>
                .
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-300">
                One place for Atlas, marketing, training, resources, and team execution.
              </p>
            </div>
          </div>
          <div className="flex w-full max-w-[580px] flex-col items-center gap-5">
            <div className="w-full">
              {welcomeVideoUrl ? (
                <div className="card command-glow aspect-video overflow-hidden border-accent-champagne/20 bg-ink-950/60">
                  <iframe
                    src={welcomeVideoUrl}
                    title="LegendsOS welcome"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="h-full w-full"
                  />
                </div>
              ) : (
                <div className="card command-glow flex aspect-video flex-col items-center justify-center gap-2 p-6 text-center text-ink-300">
                  <PlayCircle size={28} className="text-accent-champagne" />
                  <p className="text-sm font-medium text-ink-100">
                    Welcome video coming soon
                  </p>
                  <p className="text-xs text-ink-400">
                    Drop the URL into{" "}
                    <code className="text-accent-champagne/90">
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
              shellVersion={DESKTOP_SHELL_VERSION}
            />
          </div>
        </section>

      <section className="relative flex items-center justify-center lg:justify-end">
        <div className="w-full max-w-sm">
          {/* Centered wordmark above the form — small but present. */}
          <div className="mb-7 flex flex-col items-center gap-3 lg:hidden">
            <Logo compact />
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-gold-gradient">
              LegendsOS
            </p>
          </div>

          <div className="card-padded command-glow relative overflow-hidden p-7">
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
      </div>
    </main>
  );
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={
        compact
          ? "flex h-12 w-40 items-center justify-center rounded-xl border border-accent-champagne/20 bg-ink-950/40 px-3 shadow-glass backdrop-blur"
          : "flex h-20 w-72 items-center justify-center rounded-2xl border border-accent-champagne/20 bg-ink-950/40 px-5 shadow-glass backdrop-blur"
      }
    >
      <img
        src="/assets/logos/legends-os-logo.png"
        alt="LegendsOS"
        className={compact ? "h-10 w-full object-contain" : "h-16 w-full object-contain"}
      />
    </div>
  );
}

function DesktopDownloadCard({
  macUrl,
  winUrl,
  shellVersion,
}: {
  macUrl: string;
  winUrl: string;
  shellVersion: string;
}) {
  return (
    <div className="card command-glow w-full max-w-[580px] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-accent-champagne/30 bg-accent-gold/10 text-accent-champagne">
            <Download size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-ink-100">
              Download LegendsOS Desktop
            </p>
            <p className="mt-0.5 text-xs text-ink-400">
              Native window on Mac or Windows. Same login, same data.
            </p>
          </div>
        </div>
        <span className="rounded-full border border-accent-champagne/20 bg-ink-950/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-ink-300">
          v{shellVersion}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <DesktopButton
          href={macUrl}
          label="Download for Mac"
          pendingLabel="Mac test build pending"
          icon={<Apple size={14} />}
        />
        <DesktopButton
          href={winUrl}
          label="Download for Windows"
          pendingLabel="Windows test build pending"
          icon={<MonitorDown size={14} />}
          variant="ghost"
        />
      </div>
      <p className="mt-3 text-[11px] text-ink-400">
        Web app also available —{" "}
        <span className="font-medium text-ink-200">sign in on the right</span>{" "}
        from any browser. Unsigned test builds may show a Gatekeeper /
        SmartScreen warning the first time you launch.
      </p>
    </div>
  );
}

function DesktopButton({
  href,
  label,
  pendingLabel,
  icon,
  variant = "primary",
}: {
  href: string;
  label: string;
  pendingLabel: string;
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
        title="No artifact yet. Set NEXT_PUBLIC_DESKTOP_*_DOWNLOAD_URL or drop the installer in public/downloads/ to enable."
      >
        {icon}
        <span>{pendingLabel}</span>
      </button>
    );
  }
  return (
    <a href={href} className={baseClasses} target="_blank" rel="noopener noreferrer">
      {icon}
      {label}
    </a>
  );
}

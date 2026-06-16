import { existsSync } from "node:fs";
import path from "node:path";

import Link from "next/link";
import { headers } from "next/headers";
import { Apple, Download, MonitorDown } from "lucide-react";

import { LoginForm } from "@/components/auth/LoginForm";
import { PUBLIC_ENV, isSupabaseConfigured } from "@/lib/env";
import { hexToRgbTriplet } from "@/lib/themeSnapshot";
import { resolveWorkspaceBranding } from "@/lib/themeServer";

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

function hexToRgba(hex: string, alpha: number): string {
  return `rgba(${hexToRgbTriplet(hex).replace(/ /g, ", ")}, ${alpha})`;
}

function brandOverlay(branding: Awaited<ReturnType<typeof resolveWorkspaceBranding>>) {
  const primary = branding.primaryColor ?? "#2B5D4A";
  const secondary = branding.secondaryColor ?? "#C98A6A";
  return `linear-gradient(92deg, rgba(5, 6, 10, 0.92) 0%, rgba(5, 6, 10, 0.68) 42%, rgba(5, 6, 10, 0.88) 100%),
    radial-gradient(58% 45% at 30% 18%, ${hexToRgba(primary, 0.26)} 0%, rgba(5, 6, 10, 0) 62%),
    radial-gradient(52% 45% at 82% 24%, ${hexToRgba(secondary, 0.24)} 0%, rgba(5, 6, 10, 0) 64%)`;
}

// Shell version is informational only. Bump alongside electron/main.cjs
// when the desktop wrapper itself ships a meaningful change.
const DESKTOP_SHELL_VERSION = "1.0.0";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { from?: string; error?: string; message?: string };
}) {
  const host = headers().get("x-hostname") ?? headers().get("host");
  const branding = await resolveWorkspaceBranding(host);
  const isFloProcessing = branding.workspaceSlug === "flo_processing";

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
  const redirectTo = searchParams.from ?? branding.defaultRedirectPath ?? "/dashboard";

  if (isFloProcessing) {
    return renderFloProcessingLogin({
      branding,
      searchParams,
      redirectTo,
    });
  }

  return (
    <main className="desktop-login-shell relative min-h-screen overflow-hidden bg-ink-950">
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
              ) : null}
            </div>
            <DesktopDownloadCard
              macUrl={macDownloadUrl}
              winUrl={winDownloadUrl}
              shellVersion={DESKTOP_SHELL_VERSION}
            />
          </div>
        </section>

      <section className="desktop-no-drag relative flex items-center justify-center lg:justify-end">
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
            <p className="desktop-only mt-2 hidden text-[11px] leading-relaxed text-accent-champagne/90">
              Desktop mode detected. Sign in here to keep the session inside the
              Mac app; magic links may open your default browser during beta.
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
              <LoginForm redirectTo={redirectTo} />
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

function renderFloProcessingLogin({
  branding,
  searchParams,
  redirectTo,
}: {
  branding: Awaited<ReturnType<typeof resolveWorkspaceBranding>>;
  searchParams: { from?: string; error?: string; message?: string };
  redirectTo: string;
}) {
  const logoSrc = branding.logo.url ?? "/assets/logos/lf-processing-logo.png";
  const backgroundSrc =
    branding.backgroundImage.url ??
    "/assets/backgrounds/command-center-elegant.jpg";
  const primary = branding.primaryColor ?? "#2B5D4A";
  const secondary = branding.secondaryColor ?? "#C98A6A";
  const accentStyle = {
    backgroundImage: brandOverlay(branding),
  } as React.CSSProperties;

  return (
    <main className="desktop-login-shell relative min-h-screen overflow-hidden bg-ink-950">
      {branding.backgroundVideo.url ? (
        <video
          src={branding.backgroundVideo.url}
          poster={backgroundSrc}
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover opacity-35"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
      ) : (
        <img
          src={backgroundSrc}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover opacity-35"
        />
      )}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={accentStyle}
      />
      <div className="relative grid min-h-screen items-center gap-8 px-6 py-8 lg:grid-cols-[minmax(0,1.1fr)_420px] lg:px-12 xl:px-16">
        <section className="hidden min-h-[720px] w-full max-w-[760px] flex-col justify-center lg:flex">
          <div className="mb-8 flex flex-col gap-5">
            <div className="flex items-center gap-4">
              <div
                className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-ink-950/55 p-3 shadow-glow backdrop-blur"
                style={{
                  borderColor: secondary,
                  boxShadow: `0 0 0 1px ${hexToRgba(primary, 0.22)}, 0 22px 54px -28px rgba(0,0,0,0.84)`,
                }}
              >
                <img
                  src={logoSrc}
                  alt={branding.workspaceDisplayName ?? "Flo Processing"}
                  className="h-full w-full object-contain"
                />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-accent-champagne/80">
                  {branding.workspaceDisplayName ?? "Flo Processing"}
                </p>
                <h1 className="mt-2 max-w-2xl text-5xl font-semibold leading-[1.03] tracking-tight text-ink-100">
                  {branding.loginHeadline ?? "Flo Processing Command Center"}
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-300">
                  {branding.loginSubheadline ??
                    "A smarter workspace for processing, document review, conditions, and loan flow support."}
                </p>
              </div>
            </div>
            <div className="grid max-w-3xl grid-cols-3 gap-3 pt-2">
              {[
                {
                  title: "Conditions",
                  body: "Track stipulations, responses, and the next action without losing the file thread.",
                },
                {
                  title: "Missing docs",
                  body: "See what is still outstanding, who owes it, and what should happen next.",
                },
                {
                  title: "Follow-up",
                  body: "Keep borrower and partner touchpoints moving with draft-safe support.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="card-padded min-h-[148px] border-accent-champagne/15"
                  style={{
                    backgroundColor: "rgba(5, 6, 10, 0.44)",
                    borderColor: hexToRgba(primary, 0.24),
                  }}
                >
                  <p
                    className="text-[11px] font-medium uppercase tracking-[0.22em]"
                    style={{ color: secondary }}
                  >
                    {item.title}
                  </p>
                  <p className="mt-3 text-[14px] leading-relaxed text-ink-200">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-4">
              <div className="overflow-hidden rounded-2xl border border-accent-champagne/20 bg-ink-950/50 p-2 shadow-glass backdrop-blur">
                <img
                  src="/assets/team/ashley.png"
                  alt="Ashley Rogers"
                  className="h-28 w-28 rounded-xl object-cover"
                />
              </div>
              <div className="max-w-[340px]">
                <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-accent-champagne/80">
                  Ashley Rogers
                </p>
                <p className="mt-1 text-lg font-semibold tracking-tight text-ink-100">
                  Your processing command center.
                </p>
                <p className="mt-2 text-sm leading-relaxed text-ink-300">
                  Same LegendsOS auth. Same secure session. No duplicate login,
                  no extra database, no separate CRM path.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="desktop-no-drag relative flex items-center justify-center lg:justify-end">
          <div className="w-full max-w-sm">
            <div className="mb-6 flex flex-col items-center gap-3 lg:hidden">
              <div
                className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border bg-ink-950/55 p-2 shadow-glow backdrop-blur"
                style={{
                  borderColor: secondary,
                  boxShadow: `0 0 0 1px ${hexToRgba(primary, 0.22)}`,
                }}
              >
                <img
                  src={logoSrc}
                  alt={branding.workspaceDisplayName ?? "Flo Processing"}
                  className="h-full w-full object-contain"
                />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-accent-champagne">
                {branding.workspaceDisplayName ?? "Flo Processing"}
              </p>
            </div>

            <div
              className="card-padded command-glow relative overflow-hidden p-7"
              style={{
                backgroundColor: "rgba(5, 6, 10, 0.62)",
                borderColor: hexToRgba(primary, 0.28),
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em]"
                  style={{
                    borderColor: hexToRgba(primary, 0.3),
                    color: secondary,
                  }}
                >
                  Flo Processing
                </span>
                <span className="rounded-full border border-accent-champagne/20 bg-ink-950/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-ink-300">
                  Same auth
                </span>
              </div>
              <h2 className="mt-3 text-[22px] font-semibold tracking-tight text-ink-100">
                Sign in to Ashley&apos;s workspace
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-300">
                Use your LegendsOS credentials to enter the Flo Processing
                command center. No second auth system, no duplicate profile.
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
                <LoginForm redirectTo={redirectTo} />
              </div>
              <p className="mt-5 text-[11px] leading-relaxed text-ink-400">
                Session continues into{" "}
                <span className="font-medium text-ink-200">/flo-processing</span>{" "}
                after sign-in so Ashley lands directly in the processing
                workspace.
              </p>
            </div>

            <p className="mt-5 text-center text-[11px] leading-relaxed text-ink-400">
              Need access? Jeremy provisions users through LegendsOS admin.
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
    <div className="desktop-hide card command-glow w-full max-w-[580px] p-5">
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

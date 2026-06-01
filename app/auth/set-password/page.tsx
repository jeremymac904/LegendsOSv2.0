import { SetPasswordForm } from "@/components/auth/SetPasswordForm";
import { PUBLIC_ENV } from "@/lib/env";

// Set-password landing page. Lives at /auth/set-password — a SIBLING of
// /auth/callback, deliberately OUTSIDE the auth-gated (app) route group so a
// brand-new user (who is not "signed in" in the normal sense yet) can reach it.
// Minted setup / recovery links from POST /api/admin/users redirect here after
// Supabase verifies the token; the client form then calls updateUser({ password }).
//
// /auth is already a PUBLIC_PATH in lib/supabase/middleware.ts, so no middleware
// change is required for this route to be reachable.

export const dynamic = "force-dynamic";

export default function SetPasswordPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-950 px-6 py-12">
      <img
        src="/assets/backgrounds/command-center-futuristic.jpg"
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover opacity-40"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(5,6,10,0.86),rgba(5,6,10,0.74)),radial-gradient(65%_55%_at_50%_8%,rgba(155,104,40,0.18),transparent_62%)]"
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center gap-3">
          <div className="flex h-14 w-48 items-center justify-center rounded-2xl border border-accent-champagne/20 bg-ink-950/40 px-4 shadow-glass backdrop-blur">
            <img
              src="/assets/logos/legends-os-logo.png"
              alt="LegendsOS"
              className="h-10 w-full object-contain"
            />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent-champagne/80">
            {PUBLIC_ENV.APP_NAME}
          </p>
        </div>

        <div className="card-padded command-glow relative overflow-hidden p-7">
          <p className="label">Account setup</p>
          <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-ink-100">
            Set your password
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-300">
            Choose a password for your {PUBLIC_ENV.APP_NAME} account. You reached
            this page from a one-time setup link — once your password is set,
            you&apos;ll go straight to your dashboard.
          </p>
          <div className="mt-6">
            <SetPasswordForm />
          </div>
        </div>
      </div>
    </main>
  );
}

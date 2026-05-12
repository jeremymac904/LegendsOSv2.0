import Link from "next/link";

import { LoginForm } from "@/components/auth/LoginForm";
import { PUBLIC_ENV, isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { from?: string; error?: string; message?: string };
}) {
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
          <p className="mt-4 max-w-md text-sm text-ink-300">
            Atlas chat, source-grounded knowledge, image studio, social, email,
            and calendar — unified, role-aware, and audited from day one.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs text-ink-300">
          <Bullet>Single sign-on via Supabase Auth</Bullet>
          <Bullet>Row-level security on every table</Bullet>
          <Bullet>Server-side AI provider gateway</Bullet>
          <Bullet>n8n automation jobs with safety gate</Bullet>
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
    <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-accent-orange to-accent-gold text-base font-black text-ink-950 shadow-glow">
      L
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="card flex items-start gap-2 p-3">
      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-accent-gold" />
      <span>{children}</span>
    </div>
  );
}

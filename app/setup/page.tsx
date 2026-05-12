import Link from "next/link";

import { PUBLIC_ENV } from "@/lib/env";

export default function SetupPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16">
      <div className="card-padded w-full">
        <div className="flex items-center justify-between">
          <div>
            <p className="label">{PUBLIC_ENV.APP_NAME} · setup</p>
            <h1 className="mt-1 text-2xl font-semibold text-ink-100">
              Connect Supabase to continue
            </h1>
          </div>
          <span className="chip-warn">Not configured</span>
        </div>
        <p className="mt-4 text-sm text-ink-200">
          Supabase environment variables are missing. Copy{" "}
          <code className="rounded bg-ink-800 px-1 py-0.5">.env.example</code>{" "}
          to <code className="rounded bg-ink-800 px-1 py-0.5">.env.local</code>{" "}
          and fill in <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>. Then run the migrations in{" "}
          <code className="rounded bg-ink-800 px-1 py-0.5">supabase/migrations</code>.
        </p>
        <div className="mt-6 grid gap-3 text-sm text-ink-200">
          <Step
            n={1}
            title="Create a Supabase project"
            body="From the Supabase dashboard, create a new project for LegendsOS 2.0."
          />
          <Step
            n={2}
            title="Set environment variables"
            body="Add SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY to .env.local."
          />
          <Step
            n={3}
            title="Run migrations"
            body="Apply the SQL files in supabase/migrations in order. The bootstrap migration seeds the Legends org and promotes the owner email."
          />
          <Step
            n={4}
            title="Sign in"
            body={`Visit /login with the owner email (${PUBLIC_ENV.OWNER_EMAIL}) and you'll land on Command Center.`}
          />
        </div>
        <div className="mt-6 flex items-center justify-between text-xs text-ink-300">
          <span>Need help? See docs/SETUP.md</span>
          <Link className="btn-ghost" href="/login">
            Continue anyway →
          </Link>
        </div>
      </div>
    </main>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="card flex items-start gap-4 p-4">
      <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-accent-orange to-accent-gold text-xs font-bold text-ink-950">
        {n}
      </div>
      <div>
        <p className="font-medium text-ink-100">{title}</p>
        <p className="text-sm text-ink-300">{body}</p>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect } from "react";

// Error boundary scoped to the authenticated (app) route group. A thrown
// Server Component error degrades to this in-shell card instead of dropping
// the whole authed shell to the root boundary. Self-contained on purpose —
// no shell imports that could themselves throw.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-[50vh] place-items-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-ink-200 bg-white/70 p-6 text-center shadow-sm dark:border-ink-800 dark:bg-ink-900/50">
        <p className="text-[10px] uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
          Error
        </p>
        <h1 className="mt-2 text-xl font-semibold text-ink-900 dark:text-ink-100">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">
          This view hit an unexpected error. You can retry, or head back to your
          dashboard — the rest of the app is still running.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <button onClick={reset} className="btn-primary">
            Try again
          </button>
          <Link href="/dashboard" className="btn-ghost text-sm">
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

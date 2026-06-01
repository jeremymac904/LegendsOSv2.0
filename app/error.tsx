"use client";

import { useEffect } from "react";

export default function GlobalError({
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
    <main className="mx-auto grid min-h-screen max-w-xl place-items-center px-6">
      <div className="w-full rounded-2xl border border-ink-200 bg-white/70 p-6 text-center shadow-sm dark:border-ink-800 dark:bg-ink-900/50">
        <p className="text-[10px] uppercase tracking-[0.18em] text-ink-500 dark:text-ink-400">
          Error
        </p>
        <h1 className="mt-2 text-xl font-semibold text-ink-900 dark:text-ink-100">
          Something went wrong
        </h1>
        <p className="mt-2 text-xs text-ink-600 dark:text-ink-300">
          {error.message}
        </p>
        <button onClick={reset} className="btn-primary mt-4">
          Try again
        </button>
      </div>
    </main>
  );
}

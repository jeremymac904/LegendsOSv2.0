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
      <div className="card-padded w-full text-center">
        <p className="label">Error</p>
        <h1 className="mt-2 text-xl font-semibold text-ink-100">
          Something went wrong
        </h1>
        <p className="mt-2 text-xs text-ink-300">{error.message}</p>
        <button onClick={reset} className="btn-primary mt-4">
          Try again
        </button>
      </div>
    </main>
  );
}

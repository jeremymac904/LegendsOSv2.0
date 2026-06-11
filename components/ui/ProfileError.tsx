"use client";

import { AlertTriangle } from "lucide-react";

export function ProfileError() {
  return (
    <div className="mx-auto grid min-h-[40vh] max-w-md place-items-center px-6">
      <div className="card-padded w-full text-center">
        <AlertTriangle
          size={28}
          className="mx-auto text-accent-gold"
        />
        <h2 className="mt-3 text-lg font-semibold text-ink-100">
          Unable to load your profile
        </h2>
        <p className="mt-2 text-xs text-ink-300">
          This can happen after a session timeout or a temporary database
          issue. Try refreshing, or sign out and back in.
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="btn-primary text-sm"
          >
            Refresh page
          </button>
          <a href="/login" className="btn-ghost text-sm">
            Sign in again
          </a>
        </div>
      </div>
    </div>
  );
}

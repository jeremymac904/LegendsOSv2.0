// LegendsOS v2 — Loan Brain Google Drive connection status (READ-ONLY)
// -----------------------------------------------------------------------------
// This module reports whether a live, read-only Google Drive connection is
// available. It NEVER writes to Drive and exposes NO secrets — it only checks
// for the PRESENCE of OAuth env var names and an explicit read-only enable
// flag. Until that flag + OAuth client are present, the Loan Brain runs in
// "sample" mode against lib/loanbrain/sampleData.ts.
// -----------------------------------------------------------------------------

import type { DriveConnectionStatus } from "./types";

// The working mortgage operations workspace from the handoff doc.
export const JEREMY_PIPELINE_FOLDER_URL =
  "https://drive.google.com/drive/folders/1X8BD29eHIzK9TJOssKB1hq3EH-Y1H7mW";

// We consider Drive "live" only when BOTH the Google OAuth client is present
// AND the owner has explicitly opted into the read-only Loan Brain connection.
// This keeps live mode off by default — sample mode is the safe baseline.
function googleOAuthPresent(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET
  );
}

function readOnlyDriveOptIn(): boolean {
  // Explicit opt-in flag. Absent/false => sample mode. Never enables writes.
  return process.env.LOAN_BRAIN_DRIVE_READONLY === "true";
}

// HONESTY GATE (Sprint 2 — "Stop Lying").
// Env presence alone does NOT mean the Loan Brain is reading live Drive data.
// Today EVERY read path (lib/loanbrain/store.ts) returns `source: "sample"` —
// there is no live Drive fetch wired up yet. So the green "connection active"
// banner must NEVER show on env presence alone.
//
// This function is the single source of truth for whether reads actually return
// live data. It is hard-`false` until a real read-only Drive fetch is wired into
// the store and proven to return live results. When that lands, flip this to
// reflect the actual data path (e.g. a successful live probe), not env vars.
function liveReadsAvailable(): boolean {
  return false;
}

export function getDriveConnectionStatus(): DriveConnectionStatus {
  const oauth = googleOAuthPresent();
  const optIn = readOnlyDriveOptIn();
  // Configuration can be present, but "connected" requires that reads actually
  // return live data. Until liveReadsAvailable() is true, we stay in sample mode
  // no matter what env vars are set — the banner reflects the real data path.
  const configured = oauth && optIn;
  const connected = configured && liveReadsAvailable();

  const rootUrl = process.env.LOAN_BRAIN_PIPELINE_FOLDER_URL || JEREMY_PIPELINE_FOLDER_URL;

  const checklist = [
    {
      label: "Google OAuth client configured (GOOGLE_OAUTH_CLIENT_ID / _SECRET)",
      done: oauth,
    },
    {
      label: "Read-only Drive scope requested (drive.readonly / drive.metadata.readonly)",
      done: oauth, // scope is requested as part of the OAuth client setup
    },
    {
      label: "Jeremy Applicants Pipeline folder shared read-only to the connected identity",
      done: Boolean(process.env.LOAN_BRAIN_PIPELINE_FOLDER_URL),
    },
    {
      label: "Owner opt-in flag enabled (LOAN_BRAIN_DRIVE_READONLY=true)",
      done: optIn,
    },
    {
      label: "Live read-only Drive reads returning real folder/file data",
      done: liveReadsAvailable(),
    },
  ];

  return {
    connected,
    mode: connected ? "live" : "sample",
    reason: connected
      ? "Read-only Google Drive connection is active and returning live data."
      : !oauth
      ? "Google OAuth client is not configured yet. Running on safe sample data."
      : !optIn
      ? "Read-only Drive opt-in is off. Running on safe sample data."
      : "Drive credentials are configured, but live read-only reads are not wired up yet — every read still returns demo borrower data. Running in sample mode.",
    identityNeeded:
      "A Google Workspace identity with read-only access to the Jeremy Applicants Pipeline folder (Loan Factory corporate or mcdonald-mtg.com).",
    scopeNeeded: "drive.readonly (or drive.metadata.readonly) — read-only only.",
    rootFolderLabel: "Jeremy Applicants Pipeline",
    rootFolderUrl: rootUrl,
    readOnly: true,
    lastCheckedAt: new Date().toISOString(),
    checklist,
  };
}

// LegendsOS v2 — Loan Memory source connectors (STATUS ONLY).
//
// SAFETY: This module performs NO live calls and NO writes of any kind. In
// particular it NEVER reads, writes, moves, deletes, or uploads anything in
// Google Drive or Google Sheets. It only reports whether the *configuration*
// for a connector is present, so the UI can show an honest connected / dormant
// / sample state. Env values are never returned — only booleans derived from
// the *presence* of an env name.

import type { SupabaseClient } from "@supabase/supabase-js";

import type { LoanFolderCategory, MemoryEventType } from "./types";
import { LOAN_FOLDER_STRUCTURE } from "./types";

/** Generic connector mode shared across status helpers. */
export type ConnectorMode = "sample" | "readonly" | "configured" | "dormant";

/** True only when a non-empty env value is present. Never returns the value. */
function hasEnv(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

/** True when the env value is present and reads as truthy ("1"/"true"/"yes"). */
function envFlag(name: string): boolean {
  const v = (process.env[name] ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

// ---------------------------------------------------------------------------
// Google Drive — READ-ONLY at most. Never writes.
// ---------------------------------------------------------------------------

export interface DriveConnectorStatus {
  /** True when Google OAuth env names are present (config only — not verified). */
  connected: boolean;
  /**
   * 'readonly' when LOAN_BRAIN_DRIVE_READONLY is explicitly enabled AND OAuth
   * config is present; otherwise 'sample'. We never expose a write mode here.
   */
  mode: "sample" | "readonly";
  /** The canonical active-loan folder layout (for display + future sorting). */
  folderStructure: readonly LoanFolderCategory[];
  /** Which OAuth env names were detected (booleans only — never the values). */
  oauth: {
    clientId: boolean;
    clientSecret: boolean;
    refreshToken: boolean;
  };
  /** Whether the read-only flag is explicitly set. */
  readonlyFlag: boolean;
  /** Human-readable note describing exactly what is and isn't active. */
  note: string;
}

/**
 * Reports Drive connector status from env presence only.
 *
 * No Drive API is contacted. No file is read or written. When OAuth env names
 * are present and LOAN_BRAIN_DRIVE_READONLY is enabled, mode is 'readonly'
 * (the system may later LIST/READ folders to sort intake) — writes are still
 * never performed anywhere in this codebase. Otherwise mode is 'sample'.
 */
export function driveConnectorStatus(): DriveConnectorStatus {
  const oauth = {
    clientId: hasEnv("GOOGLE_OAUTH_CLIENT_ID"),
    clientSecret: hasEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
    refreshToken: hasEnv("GOOGLE_OAUTH_REFRESH_TOKEN"),
  };
  const readonlyFlag = envFlag("LOAN_BRAIN_DRIVE_READONLY");
  const connected = oauth.clientId && oauth.clientSecret;
  const mode: "sample" | "readonly" = connected && readonlyFlag ? "readonly" : "sample";

  const note =
    mode === "readonly"
      ? "Drive OAuth config present and read-only flag enabled. Folder listing/read only — this app never writes, moves, deletes, or uploads to Drive."
      : connected
        ? "Drive OAuth config present but read-only flag not enabled — running in sample mode. No Drive access is performed."
        : "Drive not configured — sample mode. No Drive access is performed.";

  return {
    connected,
    mode,
    folderStructure: LOAN_FOLDER_STRUCTURE,
    oauth,
    readonlyFlag,
    note,
  };
}

// ---------------------------------------------------------------------------
// Legends Master Pipeline Google Sheet — fallback source (placeholder).
// ---------------------------------------------------------------------------

export interface SheetConnectorStatus {
  /** True only when a sheet id env name is present. Never reads the sheet. */
  configured: boolean;
  /** Label of the fallback source. */
  label: string;
  /** Human-readable note. */
  note: string;
}

/**
 * Reports the Legends Master Pipeline Google Sheet fallback status.
 *
 * Placeholder only. No Sheet API is contacted and nothing is ever written.
 * Returns { configured: false } unless a sheet id env name is present.
 */
export function sheetConnectorStatus(): SheetConnectorStatus {
  const configured = hasEnv("LEGENDS_MASTER_PIPELINE_SHEET_ID");
  return {
    configured,
    label: "Legends Master Pipeline (Google Sheet)",
    note: configured
      ? "Sheet id configured. Reserved as a read-only pipeline fallback — not yet wired, no Sheet access performed, never written."
      : "No Sheet id configured. Pipeline fallback inactive.",
  };
}

// ---------------------------------------------------------------------------
// Obsidian markdown vault — optional local memory mirror (placeholder).
// ---------------------------------------------------------------------------

export interface ObsidianVaultStatus {
  /** True only when a vault path env name is present. */
  configured: boolean;
  label: string;
  note: string;
}

/**
 * Optional Obsidian markdown vault placeholder (a local, human-readable mirror
 * of loan memory). Placeholder only — no filesystem access is performed here.
 */
export function obsidianVaultStatus(): ObsidianVaultStatus {
  const configured = hasEnv("LOAN_MEMORY_OBSIDIAN_VAULT_PATH");
  return {
    configured,
    label: "Obsidian vault (optional markdown mirror)",
    note: configured
      ? "Vault path configured. Reserved as an optional markdown mirror — not yet wired, no filesystem access performed."
      : "No vault path configured. Optional markdown mirror inactive.",
  };
}

// ---------------------------------------------------------------------------
// Aggregate snapshot (convenience for the status panel + schedule page).
// ---------------------------------------------------------------------------

export interface ConnectorsSnapshot {
  drive: DriveConnectorStatus;
  sheet: SheetConnectorStatus;
  obsidian: ObsidianVaultStatus;
  /** True when the Supabase memory store is configured (the system of record). */
  supabaseConfigured: boolean;
  /**
   * Gmail intake is intentionally DORMANT until activated. We surface it here
   * as a known-but-inactive source; nothing is polled or sent.
   */
  gmailIntake: { active: false; note: string };
}

export function connectorsSnapshot(): ConnectorsSnapshot {
  return {
    drive: driveConnectorStatus(),
    sheet: sheetConnectorStatus(),
    obsidian: obsidianVaultStatus(),
    supabaseConfigured:
      hasEnv("NEXT_PUBLIC_SUPABASE_URL") &&
      (hasEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") || hasEnv("SUPABASE_ANON_KEY")),
    gmailIntake: {
      active: false,
      note: "Gmail AI Intake is dormant. No mailbox is polled and no email is sent. When activated, new intake will create email_summary memory events (draft-only) — it never auto-updates verified memory.",
    },
  };
}

// ---------------------------------------------------------------------------
// Gmail intake → memory-event hook (SIGNATURE STUB — not wired).
// ---------------------------------------------------------------------------

export interface LinkIntakeInput {
  /** The email_intake_messages row id that was classified as loan-related. */
  intakeMessageId: string;
  /** Resolved loan_memory id (caller must resolve identity FIRST — never guess). */
  loanMemoryId: string;
  /** Short, neutral summary of the email (subject + gist). No raw PII dumps. */
  summary: string;
  /** Sender label for the event source_name (e.g. "title@acme.com"). */
  fromLabel?: string;
  /** When the email was received (ISO) — used as the event source_timestamp. */
  receivedAt?: string;
  /** Assistant/user id performing the link, for the event created_by + audit. */
  assistantUserId?: string | null;
}

export interface LinkIntakeResult {
  ok: boolean;
  /** Always false from the stub — it does not perform the write. */
  linked: boolean;
  /** The event_type that WILL be written when wired. */
  plannedEventType: Extract<MemoryEventType, "email_summary">;
  note: string;
}

/**
 * Gmail-intake → loan-memory hook (STUB — intentionally inert).
 *
 * When Gmail AI Intake is activated, this is the single seam that turns a
 * classified intake email into an `email_summary` loan-memory event via
 * `writeMemoryEvent` (which already enforces the quality guardrails). Contract
 * for the future implementation:
 *
 *  - Identity MUST already be resolved (via `resolveLoanContext`). This hook
 *    NEVER guesses the borrower when multiple matches exist.
 *  - It writes an `email_summary` event with `confidence: "low"` and
 *    `source_evidence: false`, so it can NEVER set a protected status
 *    (clear_to_close / closed / denied / suspended / dead) and can NEVER
 *    overwrite verified (higher-confidence) memory. It only adds a timeline
 *    entry and refreshes `last_known_activity`.
 *  - Nothing is sent. No Drive/Sheet write occurs.
 *
 * Until wired, this returns `{ ok: true, linked: false }` and performs no I/O.
 * The `_client` and `_input` params describe the eventual call shape.
 */
export async function linkIntakeToMemory(
  _client: SupabaseClient,
  _input: LinkIntakeInput
): Promise<LinkIntakeResult> {
  // Intentionally no DB access. This is a documented seam, not an active path.
  return {
    ok: true,
    linked: false,
    plannedEventType: "email_summary",
    note: "Gmail intake hook is not activated. No memory event written. When wired, writes a low-confidence email_summary event via writeMemoryEvent (no protected-status changes, no overwrite of verified memory, no Drive writes).",
  };
}

// LegendsOS v2 — Sprint 4 — Browser Companion shared store + helpers.
//
// This module is the single place the companion API routes go through for:
//   * CORS handling for the Chrome extension (token-free; the extension calls
//     us with `credentials: 'include'` so the existing Supabase auth cookie
//     authenticates the user).
//   * Inline row types for the Sprint-4 tables (created by the Supabase lane as
//     RLS migration files but NOT applied this sprint). We do NOT depend on
//     types/database.ts edits landing first.
//   * Read/write helpers that wrap every table access in try/catch and treat a
//     missing-table error (Postgres 42P01) as "not provisioned yet" so the app
//     BUILDS and RUNS before the migration is applied. The honest signal is
//     `{ provisioned: false }`.
//   * Building the role-appropriate seeded Atlas prompt + the /atlas?prompt=
//     deep-link the extension routes captures through.
//
// SECURITY: we NEVER console.log borrower/PII content. Audit rows record only
// non-content metadata (source_url, actor, timestamp, routed assistant). The
// service client is used ONLY server-side for the audit insert; all
// user-scoped reads/writes go through the RLS-respecting server client so RLS
// applies.

import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServiceClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

// ---------------------------------------------------------------------------
// Inline row types (Sprint-4 tables). Hand-typed so the routes stay type-safe
// without waiting on a generated schema.
// ---------------------------------------------------------------------------

export type CaptureStatus = "captured" | "routed" | "dismissed" | "error";

export interface BrowserCompanionSessionRow {
  id: string;
  user_id: string;
  organization_id: string | null;
  device_label: string | null;
  user_agent: string | null;
  last_seen_at: string | null;
  created_at: string;
}

export interface BrowserCompanionCaptureRow {
  id: string;
  user_id: string;
  organization_id: string | null;
  source_url: string | null;
  source_title: string | null;
  selected_text: string | null;
  structured_context: Record<string, unknown> | null;
  routed_assistant: string | null;
  status: CaptureStatus;
  captured_at: string;
  created_at: string;
}

export interface IntegrationAuditLogRow {
  id: string;
  organization_id: string | null;
  actor_id: string | null;
  action: string;
  provider: string | null;
  target_type: string | null;
  target_id: string | null;
  source_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Provisioning-aware result wrappers. `provisioned: false` is the honest signal
// that the Sprint-4 migration has not been applied yet — it is NOT an error and
// callers must surface it as "setup needed", never as "connected".
// ---------------------------------------------------------------------------

export interface ProvisionResult<T> {
  provisioned: boolean;
  ok: boolean;
  data: T | null;
  error?: string;
}

// Postgres "undefined_table". The Supabase JS client surfaces it as a `code`
// on the returned error. Some transport layers only put it in the message, so
// we check both.
export function isMissingTableError(err: unknown): boolean {
  if (!err) return false;
  const code = (err as { code?: string }).code;
  if (code === "42P01") return true;
  const message = (err as { message?: string }).message ?? "";
  return /does not exist|42P01|undefined_table/i.test(message);
}

// ---------------------------------------------------------------------------
// CORS — token-free Chrome extension support.
//
// The extension stores NO token. It authenticates via the user's existing
// LegendsOS web-session cookie, so we must reflect the request Origin (not "*")
// and set Access-Control-Allow-Credentials: true. We only reflect a
// chrome-extension:// origin or a same-site origin; anything else gets no
// allow-origin header (the browser then blocks the cross-origin read, which is
// the safe default).
// ---------------------------------------------------------------------------

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (origin.startsWith("chrome-extension://")) return true;
  if (origin.startsWith("moz-extension://")) return true;
  // Same-site (the web app itself calling the route, e.g. the /browser-companion
  // fallback page) is always allowed.
  if (origin.startsWith("https://") || origin.startsWith("http://localhost")) {
    return true;
  }
  return false;
}

// Build CORS headers for a given request. Pass the incoming Request so we can
// reflect its Origin. When the origin is not allowed we omit the allow-origin
// header entirely (credentialed requests then fail safely).
export function corsHeaders(req: Request): Headers {
  const headers = new Headers();
  const origin = req.headers.get("origin");
  if (isAllowedOrigin(origin) && origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Vary", "Origin");
  }
  headers.set(
    "Access-Control-Allow-Methods",
    "GET,POST,OPTIONS"
  );
  headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type,Authorization,X-Requested-With"
  );
  headers.set("Access-Control-Max-Age", "86400");
  return headers;
}

// Standard OPTIONS preflight response. Routes export `OPTIONS` that call this.
export function preflight(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

// JSON response helper that always attaches CORS headers for the request.
export function corsJson(
  req: Request,
  body: unknown,
  status = 200
): Response {
  const headers = corsHeaders(req);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { status, headers });
}

// ---------------------------------------------------------------------------
// Capture persistence (user-scoped client so RLS applies).
// ---------------------------------------------------------------------------

export interface InsertCaptureInput {
  user_id: string;
  organization_id: string | null;
  source_url: string | null;
  source_title: string | null;
  selected_text: string | null;
  structured_context: Record<string, unknown> | null;
  routed_assistant: string | null;
}

// Insert a capture row through the user's RLS client. 42P01 -> not provisioned.
export async function insertCapture(
  userClient: SupabaseClient,
  input: InsertCaptureInput
): Promise<ProvisionResult<BrowserCompanionCaptureRow>> {
  try {
    const { data, error } = await userClient
      .from("browser_companion_captures")
      .insert({
        user_id: input.user_id,
        organization_id: input.organization_id,
        source_url: input.source_url,
        source_title: input.source_title,
        selected_text: input.selected_text,
        structured_context: input.structured_context ?? {},
        routed_assistant: input.routed_assistant,
        status: "routed" as CaptureStatus,
        captured_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) {
      if (isMissingTableError(error)) {
        return { provisioned: false, ok: false, data: null, error: "setup_needed" };
      }
      // Real failure (RLS denial, validation, etc.). Do NOT log row content.
      return { provisioned: true, ok: false, data: null, error: "insert_failed" };
    }
    return {
      provisioned: true,
      ok: true,
      data: data as BrowserCompanionCaptureRow,
    };
  } catch (err) {
    if (isMissingTableError(err)) {
      return { provisioned: false, ok: false, data: null, error: "setup_needed" };
    }
    return { provisioned: true, ok: false, data: null, error: "insert_failed" };
  }
}

export interface ReadCapturesInput {
  user_id: string;
  organization_id: string | null;
  all: boolean; // owner/admin org-wide view
  limit: number;
}

// Read recent captures through the user's RLS client. RLS already scopes rows
// to self + (for owner/admin) the org, so even with `all` we rely on RLS rather
// than widening past what the policy allows. 42P01 -> not provisioned.
export async function readCaptures(
  userClient: SupabaseClient,
  input: ReadCapturesInput
): Promise<ProvisionResult<BrowserCompanionCaptureRow[]>> {
  try {
    let query = userClient
      .from("browser_companion_captures")
      .select("*")
      .order("captured_at", { ascending: false })
      .limit(Math.min(Math.max(input.limit, 1), 100));

    if (!input.all) {
      query = query.eq("user_id", input.user_id);
    }

    const { data, error } = await query;
    if (error) {
      if (isMissingTableError(error)) {
        return { provisioned: false, ok: true, data: [] };
      }
      return { provisioned: true, ok: false, data: [], error: "read_failed" };
    }
    return {
      provisioned: true,
      ok: true,
      data: (data ?? []) as BrowserCompanionCaptureRow[],
    };
  } catch (err) {
    if (isMissingTableError(err)) {
      return { provisioned: false, ok: true, data: [] };
    }
    return { provisioned: true, ok: false, data: [], error: "read_failed" };
  }
}

// ---------------------------------------------------------------------------
// Session registration (best-effort, user-scoped).
// ---------------------------------------------------------------------------

export interface RegisterSessionInput {
  user_id: string;
  organization_id: string | null;
  device_label: string | null;
  user_agent: string | null;
}

export async function registerSession(
  userClient: SupabaseClient,
  input: RegisterSessionInput
): Promise<ProvisionResult<BrowserCompanionSessionRow>> {
  try {
    const { data, error } = await userClient
      .from("browser_companion_sessions")
      .insert({
        user_id: input.user_id,
        organization_id: input.organization_id,
        device_label: input.device_label,
        user_agent: input.user_agent,
        last_seen_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) {
      if (isMissingTableError(error)) {
        return { provisioned: false, ok: false, data: null, error: "setup_needed" };
      }
      return { provisioned: true, ok: false, data: null, error: "insert_failed" };
    }
    return {
      provisioned: true,
      ok: true,
      data: data as BrowserCompanionSessionRow,
    };
  } catch (err) {
    if (isMissingTableError(err)) {
      return { provisioned: false, ok: false, data: null, error: "setup_needed" };
    }
    return { provisioned: true, ok: false, data: null, error: "insert_failed" };
  }
}

// ---------------------------------------------------------------------------
// Audit log (service-role insert, server-side only). We record ONLY non-content
// metadata: the source URL, the actor, the timestamp, and the routed assistant.
// We NEVER write selected_text / structured_context here, and NEVER console.log
// borrower content. A missing table is swallowed honestly (no throw) so a
// capture still succeeds before the migration is applied.
// ---------------------------------------------------------------------------

export interface AuditCaptureInput {
  actor_user_id: string;
  organization_id: string | null;
  source_url: string | null;
  routed_assistant: string | null;
  capture_id: string | null;
}

export async function auditCapture(
  input: AuditCaptureInput
): Promise<{ provisioned: boolean; ok: boolean }> {
  try {
    const service = getSupabaseServiceClient();
    const { error } = await service.from("integration_audit_log").insert({
      organization_id: input.organization_id,
      actor_id: input.actor_user_id,
      action: "browser_companion_capture",
      provider: "browser_companion",
      target_type: "browser_companion_capture",
      target_id: input.capture_id,
      source_url: input.source_url,
      metadata: {
        routed_assistant: input.routed_assistant,
        capture_id: input.capture_id,
        at: new Date().toISOString(),
      },
    });
    if (error) {
      if (isMissingTableError(error)) {
        return { provisioned: false, ok: false };
      }
      // Audit failure must not break the capture; record a non-PII signal only.
      return { provisioned: true, ok: false };
    }
    return { provisioned: true, ok: true };
  } catch (err) {
    if (isMissingTableError(err)) {
      return { provisioned: false, ok: false };
    }
    return { provisioned: true, ok: false };
  }
}

export interface ReadAuditInput {
  organization_id: string | null;
  limit: number;
}

// Owner/admin audit read. RLS restricts integration_audit_log to owner/admin on
// the DB side; we still use the user-scoped client so the policy enforces.
export async function readAudit(
  userClient: SupabaseClient,
  input: ReadAuditInput
): Promise<ProvisionResult<IntegrationAuditLogRow[]>> {
  try {
    const { data, error } = await userClient
      .from("integration_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(input.limit, 1), 200));

    if (error) {
      if (isMissingTableError(error)) {
        return { provisioned: false, ok: true, data: [] };
      }
      return { provisioned: true, ok: false, data: [], error: "read_failed" };
    }
    return {
      provisioned: true,
      ok: true,
      data: (data ?? []) as IntegrationAuditLogRow[],
    };
  } catch (err) {
    if (isMissingTableError(err)) {
      return { provisioned: false, ok: true, data: [] };
    }
    return { provisioned: true, ok: false, data: [], error: "read_failed" };
  }
}

// ---------------------------------------------------------------------------
// Assistant routing — every capture routes through Atlas via
// /atlas?prompt=<encoded seeded prompt>. We build a role-appropriate framing
// from the task + assistant + a short context summary. AtlasWorkspace reads
// ?prompt= and caps at 8000 chars, so we cap here too.
// ---------------------------------------------------------------------------

export type CompanionAssistant =
  | "owner"
  | "loan_officer"
  | "processor"
  | "coordinator";

const PROMPT_CAP = 8000;

// Map the requested assistant to a role-appropriate Atlas framing line. Until
// dedicated FLO/Coordinator assistants exist, every assistant maps to Atlas —
// the framing differs by role. This is honest: Atlas is the working AI.
function framingFor(assistant: CompanionAssistant): string {
  switch (assistant) {
    case "owner":
      return "You are Atlas, acting as the owner's operating partner. Think like the principal of the brokerage: revenue, pipeline health, team leverage, and what to do next.";
    case "loan_officer":
      return "You are Atlas, supporting a loan officer. Focus on the borrower relationship, the loan scenario, next milestones, and clear client-facing communication.";
    case "processor":
      return "You are Atlas, supporting a file/loan processor (FLO). Focus on conditions, document status, stacking order, and exactly what is missing to advance the file.";
    case "coordinator":
      return "You are Atlas, supporting a transaction/marketing coordinator. Focus on tasks, scheduling, follow-ups, and keeping every party aligned.";
    default:
      return "You are Atlas, the LegendsOS operating assistant.";
  }
}

// Validate / normalize an arbitrary assistant string from the extension.
export function normalizeAssistant(value: unknown): CompanionAssistant {
  if (
    value === "owner" ||
    value === "loan_officer" ||
    value === "processor" ||
    value === "coordinator"
  ) {
    return value;
  }
  return "loan_officer";
}

// Pick a sensible default assistant from the user's role when the extension
// does not specify one.
export function assistantForRole(role: UserRole): CompanionAssistant {
  switch (role) {
    case "owner":
    case "admin":
      return "owner";
    case "processor":
      return "processor";
    case "coordinator":
      return "coordinator";
    case "loan_officer":
    default:
      return "loan_officer";
  }
}

export interface BuildPromptInput {
  assistant: CompanionAssistant;
  task: string;
  source_url: string | null;
  source_title: string | null;
  selected_text: string | null;
  structured_context: Record<string, unknown> | null;
}

// Build a compact, non-PII-leaking context summary. We DO include the user's
// own captured selected_text because the user explicitly chose to send it to
// their own assistant — but we never log it to console, and we trim it so the
// deep-link stays under the Atlas prompt cap.
function contextSummary(input: BuildPromptInput): string {
  const lines: string[] = [];
  if (input.source_title) lines.push(`Source: ${input.source_title}`);
  if (input.source_url) lines.push(`URL: ${input.source_url}`);

  if (input.structured_context && typeof input.structured_context === "object") {
    const entries = Object.entries(input.structured_context).slice(0, 12);
    for (const [key, value] of entries) {
      if (value == null) continue;
      const v =
        typeof value === "string"
          ? value
          : JSON.stringify(value);
      lines.push(`${key}: ${v.slice(0, 400)}`);
    }
  }

  if (input.selected_text && input.selected_text.trim()) {
    lines.push("");
    lines.push("Captured text:");
    lines.push(input.selected_text.trim().slice(0, 4000));
  }

  return lines.join("\n");
}

// Build the full seeded prompt string.
export function buildSeededPrompt(input: BuildPromptInput): string {
  const framing = framingFor(input.assistant);
  const summary = contextSummary(input);
  const task = input.task.trim().slice(0, 2000);

  const prompt = [
    framing,
    "",
    "I captured the following from my browser via the LegendsOS companion:",
    "",
    summary,
    "",
    `Task: ${task}`,
  ].join("\n");

  return prompt.slice(0, PROMPT_CAP);
}

// Build the /atlas?prompt= deep-link the capture route returns as routing.href.
export function buildRoutingHref(input: BuildPromptInput): {
  href: string;
  seeded_prompt: string;
} {
  const seeded = buildSeededPrompt(input);
  const href = `/atlas?prompt=${encodeURIComponent(seeded)}`;
  return { href, seeded_prompt: seeded };
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Globe,
  Inbox,
  Loader2,
  Lock,
  Puzzle,
  RefreshCw,
  Save,
  ScrollText,
  Settings2,
} from "lucide-react";

import { EmptyState } from "@/components/ui/EmptyState";
import { StatusPill } from "@/components/ui/StatusPill";
import type { UserRole } from "@/types/database";

// ---------------------------------------------------------------------------
// Types — these mirror the inline row types the companion API lane returns.
// We intentionally keep them permissive (everything optional) so a partial or
// older API response never crashes the client; missing fields degrade to
// honest "—" placeholders rather than throwing.
// ---------------------------------------------------------------------------
interface CaptureRow {
  id?: string;
  source_url?: string | null;
  source_title?: string | null;
  selected_text?: string | null;
  structured_context?: Record<string, unknown> | null;
  captured_at?: string | null;
  routed_assistant?: string | null;
  status?: string | null;
  // The API may precompute the role-appropriate Atlas href; if present we use
  // it verbatim so server + client stay in sync about routing.
  atlas_href?: string | null;
}

// The /context endpoint's expected shape. `provisioned: false` is the honest
// signal the API sends when the underlying table does not exist yet (42P01).
interface ContextResponse {
  ok?: boolean;
  provisioned?: boolean;
  paired?: boolean;
  scope?: string;
  device_label?: string | null;
  captures?: CaptureRow[];
  error?: string | null;
  message?: string | null;
}

// A captured payload handed off via the URL hash fallback (#payload=...).
interface HandoffPayload {
  source_url?: string;
  source_title?: string;
  selected_text?: string;
  structured_context?: Record<string, unknown>;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "unauthenticated" }
  | { kind: "not_provisioned"; message?: string | null }
  | { kind: "not_detected" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: ContextResponse };

const CONTEXT_ENDPOINT = "/api/browser-companion/context";
const CAPTURE_ENDPOINT = "/api/browser-companion/capture";

// The capture API's `assistant` enum (lib/browserCompanion/store). Every role
// maps onto one of these — the API builds the role-appropriate seeded prompt
// from it server-side, and we mirror the framing client-side for direct links.
type CompanionAssistant = "owner" | "loan_officer" | "processor" | "coordinator";

// ---------------------------------------------------------------------------
// Role -> assistant routing. Every role currently routes to Atlas (the working
// AI), but each gets a role-appropriate framing so the seeded prompt reads
// correctly. Dedicated FLO/Coordinator assistants map onto Atlas assistants
// when configured later — for now this is honest: Atlas is the engine.
// ---------------------------------------------------------------------------
interface RouteTarget {
  key: string;
  assistant: CompanionAssistant; // the value the capture API expects
  label: string; // button label, e.g. "Open in Atlas"
  framing: string; // first-person framing line for the seeded prompt
}

function routeTargetsForRole(role: UserRole): RouteTarget[] {
  switch (role) {
    case "owner":
    case "admin":
      return [
        {
          key: "atlas-owner",
          assistant: "owner",
          label: "Open in Atlas",
          framing:
            "You are Atlas, the owner's operating assistant for the Legends Mortgage Team. Help me act on the portal context below from an owner / team-lead perspective.",
        },
      ];
    case "loan_officer":
      return [
        {
          key: "atlas-lo",
          assistant: "loan_officer",
          label: "Open in Atlas (LO)",
          framing:
            "You are Atlas helping a loan officer. Use the captured portal context below to help me move this loan forward (next steps, borrower follow-up, structuring).",
        },
      ];
    case "processor":
      return [
        {
          key: "atlas-flo",
          assistant: "processor",
          label: "Open in FLO",
          framing:
            "You are Atlas in FLO / processor mode. Use the captured portal context below to help me process this file (conditions, documents, status, stips).",
        },
      ];
    case "coordinator":
      return [
        {
          key: "atlas-coordinator",
          assistant: "coordinator",
          label: "Open in Coordinator",
          framing:
            "You are Atlas in coordinator mode. Use the captured portal context below to help me coordinate this file (scheduling, communication, task hand-offs).",
        },
      ];
    default:
      return [
        {
          key: "atlas-default",
          assistant: "owner",
          label: "Open in Atlas",
          framing:
            "You are Atlas. Use the captured portal context below to help me with this task.",
        },
      ];
  }
}

// Build a single seeded-prompt string from a capture + role framing. Kept
// compact and explicit so the AI gets the source, a context summary, and the
// task. We never include anything beyond what was captured.
function buildSeededPrompt(
  framing: string,
  capture: {
    source_url?: string | null;
    source_title?: string | null;
    selected_text?: string | null;
    structured_context?: Record<string, unknown> | null;
  }
): string {
  const lines: string[] = [framing, "", "Captured context:"];
  if (capture.source_title) lines.push(`• Page: ${capture.source_title}`);
  if (capture.source_url) lines.push(`• URL: ${capture.source_url}`);
  if (capture.selected_text) {
    lines.push("", "Selected text:", capture.selected_text.slice(0, 4000));
  }
  if (
    capture.structured_context &&
    typeof capture.structured_context === "object" &&
    Object.keys(capture.structured_context).length > 0
  ) {
    let serialized = "";
    try {
      serialized = JSON.stringify(capture.structured_context).slice(0, 2000);
    } catch {
      serialized = "";
    }
    if (serialized) lines.push("", "Structured context (JSON):", serialized);
  }
  lines.push(
    "",
    "Task: Summarize what this is and recommend the next best action."
  );
  return lines.join("\n");
}

function atlasHrefFor(framing: string, capture: CaptureRow): string {
  const prompt = buildSeededPrompt(framing, capture);
  return `/atlas?prompt=${encodeURIComponent(prompt.slice(0, 7900))}`;
}

// Parse the #payload= fallback hand-off. The extension base64url-encodes a JSON
// payload into the hash when cross-origin cookies are blocked. We decode
// defensively and only keep known scalar/object fields — never trust the hash.
function parseHandoffFromHash(hash: string): HandoffPayload | null {
  if (!hash) return null;
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(clean);
  const raw = params.get("payload");
  if (!raw) return null;
  let decoded = "";
  try {
    // Support base64url and plain URL-encoded JSON.
    const maybeB64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    if (/^[A-Za-z0-9+/=]+$/.test(maybeB64) && maybeB64.length % 4 !== 1) {
      try {
        decoded = atob(maybeB64);
      } catch {
        decoded = decodeURIComponent(raw);
      }
    } else {
      decoded = decodeURIComponent(raw);
    }
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(decoded) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return null;
    const out: HandoffPayload = {};
    if (typeof parsed.source_url === "string")
      out.source_url = parsed.source_url.slice(0, 2000);
    if (typeof parsed.source_title === "string")
      out.source_title = parsed.source_title.slice(0, 500);
    if (typeof parsed.selected_text === "string")
      out.selected_text = parsed.selected_text.slice(0, 8000);
    if (
      parsed.structured_context &&
      typeof parsed.structured_context === "object" &&
      !Array.isArray(parsed.structured_context)
    ) {
      out.structured_context = parsed.structured_context as Record<
        string,
        unknown
      >;
    }
    // Require at least a URL or some text to be a meaningful hand-off.
    if (!out.source_url && !out.selected_text && !out.source_title) return null;
    return out;
  } catch {
    return null;
  }
}

function formatTimestamp(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function hostOf(url?: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function isHttpUrl(url?: string | null): url is string {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function CompanionClient({
  role,
  appName,
  baseUrl,
}: {
  role: UserRole;
  appName: string;
  baseUrl: string;
}) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [handoff, setHandoff] = useState<HandoffPayload | null>(null);
  const [saveState, setSaveState] = useState<
    | { kind: "idle" }
    | { kind: "saving" }
    | { kind: "saved"; href: string | null }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const routes = useMemo(() => routeTargetsForRole(role), [role]);
  const primaryRoute = routes[0];

  const loadContext = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch(CONTEXT_ENDPOINT, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (res.status === 401 || res.status === 403) {
        setState({ kind: "unauthenticated" });
        return;
      }
      if (res.status === 404) {
        // The companion API route is not deployed yet — treat as "extension
        // / companion not detected" rather than a hard error.
        setState({ kind: "not_detected" });
        return;
      }
      if (!res.ok) {
        setState({
          kind: "error",
          message: `Companion service returned ${res.status}.`,
        });
        return;
      }
      const data = (await res.json()) as ContextResponse;
      if (data.provisioned === false) {
        setState({ kind: "not_provisioned", message: data.message });
        return;
      }
      if (data.ok === false) {
        setState({
          kind: "error",
          message: data.message ?? "Couldn't read captures right now.",
        });
        return;
      }
      setState({ kind: "ready", data });
    } catch {
      // Network error / endpoint absent — honest "not detected" state.
      setState({ kind: "not_detected" });
    }
  }, []);

  // Parse any hand-off payload from the URL hash on mount, then load context.
  useEffect(() => {
    if (typeof window !== "undefined") {
      const parsed = parseHandoffFromHash(window.location.hash);
      if (parsed) setHandoff(parsed);
    }
    void loadContext();
  }, [loadContext]);

  const handoffPreview = useMemo(() => {
    if (!handoff) return null;
    return buildSeededPrompt(primaryRoute.framing, {
      source_url: handoff.source_url ?? null,
      source_title: handoff.source_title ?? null,
      selected_text: handoff.selected_text ?? null,
      structured_context: handoff.structured_context ?? null,
    });
  }, [handoff, primaryRoute.framing]);

  // Client-built fallback href, used if the API can't be reached or doesn't
  // return a routing href (so a capture is never a dead end).
  const handoffFallbackHref = useMemo(
    () =>
      atlasHrefFor(primaryRoute.framing, {
        source_url: handoff?.source_url ?? null,
        source_title: handoff?.source_title ?? null,
        selected_text: handoff?.selected_text ?? null,
        structured_context: handoff?.structured_context ?? null,
      }),
    [handoff, primaryRoute.framing]
  );

  const saveAndRoute = useCallback(async () => {
    if (!handoff) return;
    setSaveState({ kind: "saving" });
    try {
      // The capture API validates `source_url` as a URL (or empty). Only send a
      // value that actually parses; otherwise omit it.
      const validSourceUrl = isHttpUrl(handoff.source_url)
        ? handoff.source_url
        : undefined;
      const res = await fetch(CAPTURE_ENDPOINT, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          ...(validSourceUrl ? { source_url: validSourceUrl } : {}),
          source_title: handoff.source_title,
          selected_text: handoff.selected_text,
          structured_context: handoff.structured_context,
          // `task` is required by the API; default to the standard summary task.
          task: "Summarize what this is and recommend the next best action.",
          assistant: primaryRoute.assistant,
        }),
      });
      if (res.status === 401 || res.status === 403) {
        setSaveState({
          kind: "error",
          message: "Sign in to LegendsOS to save this capture.",
        });
        return;
      }
      if (res.status === 404) {
        setSaveState({
          kind: "error",
          message:
            "Capture service isn't available yet (setup needed). You can still open it in Atlas below.",
        });
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string | null;
        provisioned?: boolean;
        routing?: { href?: string | null } | null;
      };
      const serverHref = data.routing?.href ?? null;
      // The API returns HTTP 200 with ok:false + error:"setup_needed" when the
      // table isn't provisioned. Surface that honestly, but still offer routing.
      if (data.ok === false || !res.ok) {
        setSaveState({
          kind: "error",
          message:
            data.error === "setup_needed" || data.provisioned === false
              ? "Capture storage isn't provisioned yet (setup needed). You can still open it in Atlas below."
              : `Save failed${data.error ? ` (${data.error})` : ""}.`,
        });
        return;
      }
      setSaveState({ kind: "saved", href: serverHref ?? handoffFallbackHref });
      void loadContext();
    } catch {
      setSaveState({
        kind: "error",
        message: "Network error while saving. You can still open it in Atlas.",
      });
    }
  }, [handoff, primaryRoute, handoffFallbackHref, loadContext]);

  const baseHost = hostOf(baseUrl) ?? baseUrl;

  return (
    <div className="space-y-5">
      {/* Hand-off review card — only when a #payload= hash is present. */}
      {handoff && (
        <section className="card-padded border-accent-gold/30">
          <div className="section-title">
            <div>
              <h2>Review captured context</h2>
              <p>
                Handed off from the browser companion. Review it, then save and
                route it into {appName}.
              </p>
            </div>
            <StatusPill status="info" label="review needed" />
          </div>

          <dl className="mt-4 grid gap-2 text-sm">
            <div className="flex flex-wrap gap-2">
              <dt className="label">Page</dt>
              <dd className="text-ink-900 dark:text-ink-100">
                {handoff.source_title ?? "—"}
              </dd>
            </div>
            <div className="flex flex-wrap gap-2">
              <dt className="label">URL</dt>
              <dd className="break-all text-ink-700 dark:text-ink-300">
                {handoff.source_url ?? "—"}
              </dd>
            </div>
          </dl>

          {handoff.selected_text && (
            <div className="mt-3">
              <p className="label">Selected text</p>
              <p className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-xl border border-ink-200 bg-white/70 p-3 text-[12.5px] leading-relaxed text-ink-700 dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-300">
                {handoff.selected_text}
              </p>
            </div>
          )}

          {handoffPreview && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-ink-600 dark:text-ink-300">
                Preview the seeded prompt ({primaryRoute.label})
              </summary>
              <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl border border-ink-200 bg-white/70 p-3 text-[11.5px] leading-relaxed text-ink-700 dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-300">
                {handoffPreview}
              </pre>
            </details>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={saveAndRoute}
              disabled={saveState.kind === "saving"}
              className="btn-primary text-sm disabled:opacity-60"
            >
              {saveState.kind === "saving" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              Save &amp; route
            </button>

            {/* Always offer a direct open-in-Atlas, even if the save service
                isn't provisioned, so the capture is never a dead end. */}
            {routes.map((r) => (
              <Link
                key={r.key}
                href={atlasHrefFor(r.framing, {
                  source_url: handoff.source_url ?? null,
                  source_title: handoff.source_title ?? null,
                  selected_text: handoff.selected_text ?? null,
                  structured_context: handoff.structured_context ?? null,
                })}
                className="btn-ghost text-sm"
              >
                <ArrowUpRight size={14} />
                {r.label}
              </Link>
            ))}
          </div>

          {saveState.kind === "saved" && (
            <p className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-status-ok/30 bg-status-ok/10 px-3 py-2 text-xs text-status-ok">
              Saved.
              {saveState.href && (
                <Link href={saveState.href} className="underline">
                  Open in {primaryRoute.label.replace(/^Open in /, "")}
                </Link>
              )}
            </p>
          )}
          {saveState.kind === "error" && (
            <p className="mt-3 rounded-lg border border-status-warn/30 bg-status-warn/10 px-3 py-2 text-xs text-status-warn">
              {saveState.message}
            </p>
          )}
        </section>
      )}

      {/* Pairing / status + captures list. */}
      <section className="card-padded">
        <div className="section-title">
          <div>
            <h2>Current captures</h2>
            <p>
              Context captured by the companion, newest first. Open any capture
              in the assistant that fits your role.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <CompanionStatusPill state={state} />
            <button
              type="button"
              onClick={() => void loadContext()}
              className="btn-ghost text-xs"
              disabled={state.kind === "loading"}
            >
              <RefreshCw
                size={13}
                className={state.kind === "loading" ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-4">
          {state.kind === "loading" && (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-ink-500 dark:text-ink-400">
              <Loader2 size={16} className="animate-spin" />
              Checking the companion…
            </div>
          )}

          {state.kind === "unauthenticated" && (
            <EmptyState
              icon={AlertTriangle}
              title="Sign in to view captures"
              description="Your LegendsOS session is required. The companion authenticates with your existing web session — no tokens are stored in the extension."
              action={
                <Link href="/login" className="btn-primary text-sm">
                  Go to sign in
                </Link>
              }
            />
          )}

          {state.kind === "not_detected" && (
            <EmptyState
              icon={Puzzle}
              title="Extension not detected"
              description="The browser companion service didn't respond. Install or pair the Chrome companion, or it may not be deployed in this environment yet."
              action={
                <Link
                  href="/browser-companion/setup"
                  className="btn-primary text-sm"
                >
                  Pair the extension
                </Link>
              }
            />
          )}

          {state.kind === "not_provisioned" && (
            <EmptyState
              icon={AlertTriangle}
              title="Setup needed"
              description={
                state.message ??
                "The companion storage isn't provisioned yet. Once the database migration is applied, captures will appear here."
              }
              action={
                <Link
                  href="/browser-companion/setup"
                  className="btn-ghost text-sm"
                >
                  <Settings2 size={14} />
                  Open setup
                </Link>
              }
            />
          )}

          {state.kind === "error" && (
            <EmptyState
              icon={AlertTriangle}
              title="Couldn't load captures"
              description={state.message}
              action={
                <button
                  type="button"
                  onClick={() => void loadContext()}
                  className="btn-ghost text-sm"
                >
                  <RefreshCw size={14} />
                  Try again
                </button>
              }
            />
          )}

          {state.kind === "ready" &&
            (state.data.captures && state.data.captures.length > 0 ? (
              <ul className="grid gap-2">
                {state.data.captures.map((capture, idx) => (
                  <CaptureCard
                    key={capture.id ?? `${idx}`}
                    capture={capture}
                    routes={routes}
                  />
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={Inbox}
                title="No captures yet"
                description="You're signed in. Capture context from a loan portal page with the Chrome companion and it will show up here."
                action={
                  <Link
                    href="/browser-companion/setup"
                    className="btn-ghost text-sm"
                  >
                    <Settings2 size={14} />
                    Setup &amp; pairing
                  </Link>
                }
              />
            ))}
        </div>

        <p className="mt-4 flex items-center gap-1.5 text-[11px] text-ink-500 dark:text-ink-400">
          <Globe size={12} />
          Captures route into this workspace at {baseHost}. The extension stores
          no tokens — it uses your signed-in session.
        </p>
      </section>
    </div>
  );
}

function CompanionStatusPill({ state }: { state: LoadState }) {
  switch (state.kind) {
    case "ready":
      // A successful context read means the session cookie authenticated the
      // user — in the token-free model that IS the pairing, so "signed in".
      return <StatusPill status="ok" label="signed in" />;
    case "unauthenticated":
      return <StatusPill status="warn" label="sign in" />;
    case "not_provisioned":
      return <StatusPill status="warn" label="setup needed" />;
    case "not_detected":
      return <StatusPill status="off" label="not detected" />;
    case "error":
      return <StatusPill status="err" label="error" />;
    default:
      return <StatusPill status="info" label="checking…" />;
  }
}

function CaptureCard({
  capture,
  routes,
}: {
  capture: CaptureRow;
  routes: RouteTarget[];
}) {
  const host = hostOf(capture.source_url);
  return (
    <li className="rounded-xl border border-ink-200 bg-white/70 p-3 dark:border-ink-800 dark:bg-ink-950/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink-900 dark:text-ink-100">
            {capture.source_title ?? host ?? "Captured context"}
          </p>
          {capture.source_url && (
            <p className="mt-0.5 truncate text-[11px] text-ink-500 dark:text-ink-400">
              {capture.source_url}
            </p>
          )}
        </div>
        {capture.status && (
          <StatusPill
            status={
              capture.status === "routed"
                ? "ok"
                : capture.status === "error"
                ? "err"
                : "info"
            }
            label={capture.status}
          />
        )}
      </div>

      {capture.selected_text && (
        <p className="mt-2 line-clamp-2 text-xs text-ink-600 dark:text-ink-300">
          {capture.selected_text}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {routes.map((r) => (
            <Link
              key={r.key}
              href={capture.atlas_href ?? atlasHrefFor(r.framing, capture)}
              className="btn-ghost text-[11px]"
            >
              <ArrowUpRight size={12} />
              {r.label}
            </Link>
          ))}
        </div>
        <span className="text-[11px] text-ink-500 dark:text-ink-400">
          {formatTimestamp(capture.captured_at)}
          {capture.routed_assistant ? ` · ${capture.routed_assistant}` : ""}
        </span>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// AuditLogPanel — owner/admin only. Reads the companion integration audit log
// via /api/browser-companion/audit (cookie-session auth). Non-owner/admin
// callers are gated server-side AND here: we render an honest "owner only"
// state without fetching when `canView` is false.
// ---------------------------------------------------------------------------
interface AuditRow {
  id?: string;
  action?: string | null;
  provider?: string | null;
  source_url?: string | null;
  actor_id?: string | null;
  target_type?: string | null;
  target_id?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
}

interface AuditResponse {
  ok?: boolean;
  provisioned?: boolean;
  entries?: AuditRow[];
  message?: string | null;
}

type AuditState =
  | { kind: "loading" }
  | { kind: "owner_only" }
  | { kind: "not_provisioned"; message?: string | null }
  | { kind: "not_detected" }
  | { kind: "error"; message: string }
  | { kind: "ready"; entries: AuditRow[] };

const AUDIT_ENDPOINT = "/api/browser-companion/audit";

export function AuditLogPanel({ canView }: { canView: boolean }) {
  const [state, setState] = useState<AuditState>(
    canView ? { kind: "loading" } : { kind: "owner_only" }
  );

  const loadAudit = useCallback(async () => {
    if (!canView) {
      setState({ kind: "owner_only" });
      return;
    }
    setState({ kind: "loading" });
    try {
      const res = await fetch(AUDIT_ENDPOINT, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (res.status === 401 || res.status === 403) {
        setState({ kind: "owner_only" });
        return;
      }
      if (res.status === 404) {
        setState({ kind: "not_detected" });
        return;
      }
      if (!res.ok) {
        setState({ kind: "error", message: `Service returned ${res.status}.` });
        return;
      }
      const data = (await res.json()) as AuditResponse;
      if (data.provisioned === false) {
        setState({ kind: "not_provisioned", message: data.message });
        return;
      }
      if (data.ok === false) {
        setState({
          kind: "error",
          message: data.message ?? "Couldn't read the audit log right now.",
        });
        return;
      }
      setState({ kind: "ready", entries: data.entries ?? [] });
    } catch {
      setState({ kind: "not_detected" });
    }
  }, [canView]);

  useEffect(() => {
    void loadAudit();
  }, [loadAudit]);

  return (
    <section className="card-padded">
      <div className="section-title">
        <div>
          <h2>Audit log</h2>
          <p>Companion integration events. Owner and admin only.</p>
        </div>
        {canView ? (
          <button
            type="button"
            onClick={() => void loadAudit()}
            disabled={state.kind === "loading"}
            className="btn-ghost text-xs"
          >
            <RefreshCw
              size={13}
              className={state.kind === "loading" ? "animate-spin" : ""}
            />
            Refresh
          </button>
        ) : (
          <StatusPill status="off" label="owner only" />
        )}
      </div>

      <div className="mt-4">
        {state.kind === "owner_only" && (
          <EmptyState
            icon={Lock}
            title="Owner only"
            description="The companion audit log is visible to owners and admins. Ask Jeremy if you need access."
          />
        )}
        {state.kind === "loading" && (
          <div className="flex items-center justify-center gap-2 p-6 text-sm text-ink-500 dark:text-ink-400">
            <Loader2 size={16} className="animate-spin" />
            Loading audit log…
          </div>
        )}
        {state.kind === "not_detected" && (
          <EmptyState
            icon={ScrollText}
            title="Audit service not detected"
            description="The audit endpoint didn't respond. It may not be deployed in this environment yet."
          />
        )}
        {state.kind === "not_provisioned" && (
          <EmptyState
            icon={AlertTriangle}
            title="Setup needed"
            description={
              state.message ??
              "The audit log table isn't provisioned yet. Apply the companion migration to enable it."
            }
          />
        )}
        {state.kind === "error" && (
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load the audit log"
            description={state.message}
          />
        )}
        {state.kind === "ready" &&
          (state.entries.length > 0 ? (
            <ul className="grid gap-1.5">
              {state.entries.map((entry, idx) => {
                const host = hostOf(entry.source_url);
                return (
                  <li
                    key={entry.id ?? `${idx}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink-200 bg-white/70 px-3 py-2 text-xs dark:border-ink-800 dark:bg-ink-950/40"
                  >
                    <span className="min-w-0 font-medium text-ink-900 dark:text-ink-100">
                      {entry.action ?? "event"}
                      {entry.provider ? ` · ${entry.provider}` : ""}
                      {host ? (
                        <span className="ml-1 font-normal text-ink-500 dark:text-ink-400">
                          ({host})
                        </span>
                      ) : null}
                    </span>
                    <span className="text-ink-500 dark:text-ink-400">
                      {formatTimestamp(entry.created_at)}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon={ScrollText}
              title="No audit events yet"
              description="Companion integration events will appear here as they happen."
            />
          ))}
      </div>
    </section>
  );
}

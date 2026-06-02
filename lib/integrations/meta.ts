// Meta (Facebook / Instagram) connector — DISABLED-by-default stub.
//
// This module intentionally performs ZERO outbound calls to Meta. It exists
// so that the rest of the app (Social Studio, /api/integrations/status) can
// report a clean "configured / paid_enabled" state when the app-level Meta
// credentials are in place, without us actually publishing anything until
// paid publishing is approved by the owner.
//
// Activation criteria (`configured = true`):
//   META_APP_ID AND META_APP_SECRET
//
// User-owned destination ids live in the database now. We never read global
// page / Instagram ids from env for publishing destinations.
//
// Paid publishing (`paid_enabled = true`):
//   configured && ALLOW_LIVE_SOCIAL_PUBLISH=true
//
// Server-only — never import from a client component.

import type { Profile } from "@/types/database";

export type MetaCapability =
  | "publish_post"
  | "publish_image"
  | "publish_video";

export interface MetaConfigState {
  configured: boolean;
  paid_enabled: boolean;
  capabilities: MetaCapability[];
}

function readEnv(name: string): string {
  const v = process.env[name];
  return v && v.trim() !== "" ? v : "";
}

// Presence-only check. NEVER returns the value — only whether it is set.
function envPresent(name: string): boolean {
  return readEnv(name) !== "";
}

function readBool(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (!raw) return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

/**
 * Detect Meta connector configuration. Returns booleans + capability list
 * only — never returns any env value, key, or URL.
 */
export function detectMetaConfig(): MetaConfigState {
  const appId = readEnv("META_APP_ID");
  const appSecret = readEnv("META_APP_SECRET");

  const configured = Boolean(appId && appSecret);

  const allowLive = readBool("ALLOW_LIVE_SOCIAL_PUBLISH", false);
  const paid_enabled = configured && allowLive;

  const capabilities: MetaCapability[] = configured
    ? ["publish_post", "publish_image", "publish_video"]
    : [];

  return { configured, paid_enabled, capabilities };
}

// ---------------------------------------------------------------------------
// publishStub — intentionally does NOT call Meta.
// ---------------------------------------------------------------------------

export interface MetaPublishInput {
  // Free-form fields; we only summarize them, never persist or forward.
  surface?: "facebook" | "instagram";
  text?: string;
  image_url?: string;
  video_url?: string;
  scheduled_at?: string | null;
}

export interface MetaPublishStubResult {
  ok: false;
  error:
    | "paid_enabled_false"
    | "not_implemented_yet"
    | "not_configured";
  would_have_sent?: {
    surface: "facebook" | "instagram" | "unknown";
    has_text: boolean;
    has_image: boolean;
    has_video: boolean;
    scheduled: boolean;
  };
}

/**
 * Stub publisher. Never makes a network call to Meta in this PR.
 *
 * Behavior:
 *   - Not configured     -> { ok: false, error: "not_configured" }
 *   - paid_enabled=false -> { ok: false, error: "paid_enabled_false" }
 *   - paid_enabled=true  -> { ok: false, error: "not_implemented_yet",
 *                             would_have_sent: <summary> }
 *
 * The "would_have_sent" summary is presence flags only — no content is echoed
 * back to the caller.
 */
export function publishStub(input: MetaPublishInput): MetaPublishStubResult {
  const state = detectMetaConfig();
  if (!state.configured) {
    return { ok: false, error: "not_configured" };
  }
  if (!state.paid_enabled) {
    return { ok: false, error: "paid_enabled_false" };
  }
  return {
    ok: false,
    error: "not_implemented_yet",
    would_have_sent: {
      surface: input.surface ?? "unknown",
      has_text: Boolean(input.text && input.text.trim()),
      has_image: Boolean(input.image_url && input.image_url.trim()),
      has_video: Boolean(input.video_url && input.video_url.trim()),
      scheduled: Boolean(input.scheduled_at),
    },
  };
}

// ---------------------------------------------------------------------------
// publishReadiness — honest checklist for the Social Studio readiness panel.
// ---------------------------------------------------------------------------

export interface MetaReadinessCheck {
  id:
    | "app_configured"
    | "identity_present"
    | "page_connected"
    | "owner_publish_enabled"
    | "live_safety_flag";
  label: string;
  /** True only when this requirement is actually satisfied. Never optimistic. */
  passed: boolean;
  /** Honest one-liner shown to the operator. No secrets, no values. */
  detail: string;
}

export interface MetaReadiness {
  /** Every gate the live path requires. Order = display order. */
  checks: MetaReadinessCheck[];
  /** True only when EVERY check passes. Even then we do not send this sprint. */
  all_passed: boolean;
  /** Convenience mirror of detectMetaConfig().configured. */
  configured: boolean;
  /** True iff app-level Meta credentials are present. */
  app_configured: boolean;
  /** True iff the current user has selected at least one destination. */
  identity_present: boolean;
}

/**
 * Build the publish-readiness checklist. Inputs that come from the database
 * (the owner-approval switch row) are passed in so this helper stays a pure
 * function of env-presence + the provided flags — it reads NO secret values
 * and performs NO I/O.
 *
 * @param opts.pageConnected   social_account_connections row exists for Meta
 * @param opts.publishEnabled  social_account_connections.is_publish_enabled
 */
export function publishReadiness(opts: {
  pageConnected: boolean;
  publishEnabled: boolean;
}): MetaReadiness {
  const appConfigured =
    envPresent("META_APP_ID") && envPresent("META_APP_SECRET");

  const identityPresent = opts.pageConnected;

  const liveSafetyFlag = readBool("ALLOW_LIVE_SOCIAL_PUBLISH", false);

  const checks: MetaReadinessCheck[] = [
    {
      id: "app_configured",
      label: "Meta app credentials",
      passed: appConfigured,
      detail: appConfigured
        ? "App ID and secret are present."
        : "Set META_APP_ID and META_APP_SECRET.",
    },
    {
      id: "identity_present",
      label: "Selected destination",
      passed: identityPresent,
      detail: identityPresent
        ? "A publish destination row is saved in LegendsOS."
        : "Select a Facebook Page or Instagram account in Connection Center.",
    },
    {
      id: "page_connected",
      label: "Account connection record",
      passed: opts.pageConnected,
      detail: opts.pageConnected
        ? "A Meta account connection exists in LegendsOS."
        : "No Meta account connection saved yet (setup needed).",
    },
    {
      id: "owner_publish_enabled",
      label: "Owner approval switch",
      passed: opts.publishEnabled,
      detail: opts.publishEnabled
        ? "Owner has turned the publish-enabled switch on."
        : "Owner has not enabled publishing for this account.",
    },
    {
      id: "live_safety_flag",
      label: "Live-publish safety flag",
      passed: liveSafetyFlag,
      detail: liveSafetyFlag
        ? "ALLOW_LIVE_SOCIAL_PUBLISH is on."
        : "ALLOW_LIVE_SOCIAL_PUBLISH is off (server-side master switch).",
    },
  ];

  const all_passed = checks.every((c) => c.passed);

  return {
    checks,
    all_passed,
    configured: appConfigured && identityPresent,
    app_configured: appConfigured,
    identity_present: identityPresent,
  };
}

// ---------------------------------------------------------------------------
// publishToMeta — REAL direct Graph API publisher SHAPE, fully GATED.
//
// IMPORTANT: This function is built but NEVER invoked this sprint. It is the
// capability scaffold for a later "live wiring" PR. It refuses to run unless
// EVERY gate is satisfied, and even then the network call is left as an
// explicit TODO so no PR in this sprint can accidentally send. The owner
// approval switch (is_publish_enabled) and the live safety flag must BOTH be
// passed in / on, in addition to full env configuration.
// ---------------------------------------------------------------------------

export interface MetaPublishPost {
  surface: "facebook" | "instagram";
  message?: string;
  image_url?: string;
  video_url?: string;
  /** Caller-supplied row id from social_account_connections (audit trail). */
  connection_id?: string;
}

export interface MetaPublishGateContext {
  /** social_account_connections.is_publish_enabled for the target account. */
  is_publish_enabled: boolean;
  /** Optional caller context for audit-only metadata. */
  actor?: Profile | null;
}

export class MetaPublishGateError extends Error {
  constructor(
    public readonly reason:
      | "not_configured"
      | "owner_not_approved"
      | "live_flag_off"
      | "live_wiring_pending"
  ) {
    super(`meta_publish_refused:${reason}`);
    this.name = "MetaPublishGateError";
  }
}

export interface MetaPublishResult {
  ok: true;
  platform_post_id: string;
}

/**
 * Direct Graph-API publisher. GATED and INERT for this sprint.
 *
 * Refuses (throws MetaPublishGateError) unless:
 *   1. detectMetaConfig().configured                       (env present)
 *   2. ctx.is_publish_enabled === true                     (owner switch)
 *   3. ALLOW_LIVE_SOCIAL_PUBLISH is on                     (master safety)
 *
 * When all three pass, it STILL refuses with reason "live_wiring_pending"
 * because the actual fetch() to graph.facebook.com is intentionally not wired
 * this sprint. Build the capability; do not invoke it.
 */
export async function publishToMeta(
  _post: MetaPublishPost,
  ctx: MetaPublishGateContext
): Promise<MetaPublishResult> {
  const state = detectMetaConfig();
  if (!state.configured) {
    throw new MetaPublishGateError("not_configured");
  }
  if (!ctx.is_publish_enabled) {
    throw new MetaPublishGateError("owner_not_approved");
  }
  if (!readBool("ALLOW_LIVE_SOCIAL_PUBLISH", false)) {
    throw new MetaPublishGateError("live_flag_off");
  }

  // All gates passed. The real Graph API request lives here in the live-wiring
  // PR. Shape it would take (NOT executed):
  //
  //   const endpoint = state.capabilities... /v19.0/<page-or-ig-id>/feed
  //   const res = await fetch(endpoint, { method: "POST", body: ... });
  //   const json = await res.json();
  //   return { ok: true, platform_post_id: json.id };
  //
  // Until that PR lands, we refuse rather than send.
  throw new MetaPublishGateError("live_wiring_pending");
}

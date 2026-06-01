// Meta (Facebook / Instagram) connector.
//
// Activation criteria (`configured = true`):
//   META_APP_ID        AND
//   META_ACCESS_TOKEN  AND
//   (META_PAGE_ID OR META_INSTAGRAM_ACCOUNT_ID)
//
// Paid publishing (`paid_enabled = true`):
//   configured && ALLOW_LIVE_SOCIAL_PUBLISH=true
//
// Server-only — never import from a client component.

import { recordIntegrationAudit } from "@/lib/integrations/audit";

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
  // META_APP_SECRET is read for completeness even though `configured` doesn't
  // strictly require it — Meta's posting endpoints need an access token, and
  // the secret matters for OAuth refresh which is a later phase.
  const _appSecret = readEnv("META_APP_SECRET");
  const accessToken = readEnv("META_ACCESS_TOKEN");
  const pageId = readEnv("META_PAGE_ID");
  const igAccountId = readEnv("META_INSTAGRAM_ACCOUNT_ID");

  const hasIdentity = Boolean(pageId || igAccountId);
  const configured = Boolean(appId && accessToken && hasIdentity);

  const allowLive = readBool("ALLOW_LIVE_SOCIAL_PUBLISH", false);
  const paid_enabled = configured && allowLive;

  const capabilities: MetaCapability[] = [];
  if (configured) {
    // A Facebook Page lets us publish text posts, photos, and videos.
    if (pageId) {
      capabilities.push("publish_post", "publish_image", "publish_video");
    }
    // An Instagram Business / Creator account supports image + video posts.
    // De-dupe vs. the page case.
    if (igAccountId) {
      if (!capabilities.includes("publish_image"))
        capabilities.push("publish_image");
      if (!capabilities.includes("publish_video"))
        capabilities.push("publish_video");
    }
  }

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
  /** True iff app+identity env is present (Graph credentials side). */
  app_configured: boolean;
  /** True iff a Facebook Page or IG account env id is present. */
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
    envPresent("META_APP_ID") &&
    envPresent("META_APP_SECRET") &&
    envPresent("META_ACCESS_TOKEN");

  const identityPresent =
    envPresent("META_PAGE_ID") || envPresent("META_INSTAGRAM_ACCOUNT_ID");

  const liveSafetyFlag = readBool("ALLOW_LIVE_SOCIAL_PUBLISH", false);

  const checks: MetaReadinessCheck[] = [
    {
      id: "app_configured",
      label: "Meta app credentials",
      passed: appConfigured,
      detail: appConfigured
        ? "App ID, secret, and access token are present."
        : "Set META_APP_ID, META_APP_SECRET, and META_ACCESS_TOKEN.",
    },
    {
      id: "identity_present",
      label: "Page or Instagram account",
      passed: identityPresent,
      detail: identityPresent
        ? "A Facebook Page or Instagram account id is configured."
        : "Set META_PAGE_ID or META_INSTAGRAM_ACCOUNT_ID.",
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
// publishToMeta — REAL direct Graph API publisher, fully GATED.
//
// Refuses (throws MetaPublishGateError) unless every gate is satisfied:
//   1. detectMetaConfig().configured  (all required env vars present)
//   2. ctx.is_publish_enabled         (owner approval switch)
//   3. ALLOW_LIVE_SOCIAL_PUBLISH=true (master safety env flag)
//
// Facebook: POST /{page-id}/feed (text), /photos (image), /videos (video)
// Instagram: POST /{ig-user-id}/media → /{ig-user-id}/media_publish (two-step)
// ---------------------------------------------------------------------------

import { recordIntegrationAudit } from "@/lib/integrations/audit";

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
  /** Profile acting (for audit). */
  actor?: import("@/types/database").Profile | null;
}

export class MetaPublishGateError extends Error {
  constructor(
    public readonly reason:
      | "not_configured"
      | "owner_not_approved"
      | "live_flag_off"
  ) {
    super(`meta_publish_refused:${reason}`);
    this.name = "MetaPublishGateError";
  }
}

export interface MetaPublishResult {
  ok: true;
  platform_post_id: string;
}

const GRAPH_BASE = "https://graph.facebook.com/v18.0";

/**
 * Direct Graph-API publisher. All gates enforced before any network call.
 * Tokens are only ever placed in request bodies — never logged.
 */
export async function publishToMeta(
  post: MetaPublishPost,
  ctx: MetaPublishGateContext
): Promise<MetaPublishResult> {
  // --- Gate checks (fail-closed) ---
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

  // Env values — only read after all gates pass, never logged.
  const accessToken = readEnv("META_ACCESS_TOKEN");
  const pageId = readEnv("META_PAGE_ID");
  const igAccountId = readEnv("META_INSTAGRAM_ACCOUNT_ID");

  let platform_post_id: string;

  try {
    if (post.surface === "instagram") {
      // Instagram two-step: create container then publish
      if (!igAccountId) throw new Error("META_INSTAGRAM_ACCOUNT_ID not set");

      // Step 1: Create the media container
      const containerBody: Record<string, string> = {
        access_token: accessToken,
      };
      if (post.image_url && !post.video_url) {
        containerBody.image_url = post.image_url;
        containerBody.media_type = "IMAGE";
      } else if (post.video_url) {
        containerBody.video_url = post.video_url;
        containerBody.media_type = "VIDEO";
      } else if (post.image_url) {
        containerBody.image_url = post.image_url;
        containerBody.media_type = "IMAGE";
      } else {
        throw new Error("Instagram requires at least image_url or video_url");
      }
      if (post.message) containerBody.caption = post.message;

      const containerRes = await fetch(
        `${GRAPH_BASE}/${encodeURIComponent(igAccountId)}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(containerBody),
        }
      );
      const containerJson = (await containerRes.json().catch(() => ({}))) as {
        id?: string;
        error?: { message?: string; code?: number };
      };
      if (!containerRes.ok || !containerJson.id) {
        const msg = containerJson.error?.message ?? `http ${containerRes.status}`;
        throw new Error(`instagram media container failed: ${msg}`);
      }
      const containerId = containerJson.id;

      // Step 2: Publish the container
      const publishRes = await fetch(
        `${GRAPH_BASE}/${encodeURIComponent(igAccountId)}/media_publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ creation_id: containerId, access_token: accessToken }),
        }
      );
      const publishJson = (await publishRes.json().catch(() => ({}))) as {
        id?: string;
        error?: { message?: string; code?: number };
      };
      if (!publishRes.ok || !publishJson.id) {
        const msg = publishJson.error?.message ?? `http ${publishRes.status}`;
        throw new Error(`instagram media_publish failed: ${msg}`);
      }
      platform_post_id = publishJson.id;

    } else {
      // Facebook — choose endpoint based on media type
      if (!pageId) throw new Error("META_PAGE_ID not set");

      let endpoint: string;
      const fbBody: Record<string, string> = { access_token: accessToken };

      if (post.video_url) {
        endpoint = `${GRAPH_BASE}/${encodeURIComponent(pageId)}/videos`;
        fbBody.file_url = post.video_url;
        if (post.message) fbBody.description = post.message;
      } else if (post.image_url) {
        endpoint = `${GRAPH_BASE}/${encodeURIComponent(pageId)}/photos`;
        fbBody.url = post.image_url;
        if (post.message) fbBody.caption = post.message;
      } else {
        endpoint = `${GRAPH_BASE}/${encodeURIComponent(pageId)}/feed`;
        if (post.message) fbBody.message = post.message;
      }

      const fbRes = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fbBody),
      });
      const fbJson = (await fbRes.json().catch(() => ({}))) as {
        id?: string;
        post_id?: string;
        error?: { message?: string; code?: number };
      };
      if (!fbRes.ok || (!fbJson.id && !fbJson.post_id)) {
        const msg = fbJson.error?.message ?? `http ${fbRes.status}`;
        throw new Error(`facebook publish failed: ${msg}`);
      }
      platform_post_id = fbJson.post_id ?? fbJson.id ?? "unknown";
    }

    // Audit success — no secret values in metadata
    await recordIntegrationAudit({
      actor: ctx.actor ?? null,
      action: "meta_published",
      provider: "meta",
      target_type: "social_post",
      target_id: post.connection_id ?? null,
      metadata: {
        surface: post.surface,
        has_image: Boolean(post.image_url),
        has_video: Boolean(post.video_url),
        has_text: Boolean(post.message),
      },
    });

    return { ok: true, platform_post_id };

  } catch (err) {
    // Audit failure — never log the access token
    await recordIntegrationAudit({
      actor: ctx.actor ?? null,
      action: "meta_publish_failed",
      provider: "meta",
      target_type: "social_post",
      target_id: post.connection_id ?? null,
      metadata: {
        surface: post.surface,
        error: err instanceof Error ? err.message : "unknown",
      },
    });
    throw err;
  }
}

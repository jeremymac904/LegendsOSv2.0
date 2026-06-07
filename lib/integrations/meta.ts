// Meta (Facebook / Instagram) connector — REAL per-user Graph API publisher,
// fail-closed.
//
// Config detection (detectMetaConfig) and the readiness checklist
// (publishReadiness / publishStub) perform ZERO outbound calls and exist so the
// rest of the app (Social Studio, /api/integrations/status) can report an honest
// "configured / paid_enabled" state. The LIVE publisher (publishToMeta) targets
// the SIGNED-IN USER's own Facebook Page / Instagram business account using the
// user's own stored token, and only runs when every gate passes.
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

import { recordIntegrationAudit } from "@/lib/integrations/audit";
import { getSelectedDestination } from "@/lib/integrations/destinations";
import { getUserAccessToken } from "@/lib/integrations/userToken";
import type { Profile } from "@/types/database";

const GRAPH_API_BASE = "https://graph.facebook.com/v22.0";

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
// publishToMeta — REAL direct Graph API publisher, per-user + fully GATED.
//
// Targets the signed-in user's OWN selected destination (Facebook Page /
// Instagram business account) with the user's OWN stored token. It refuses to
// run unless EVERY gate is satisfied: full env configuration, the owner/user
// approval switch (is_publish_enabled), the live safety flag
// (ALLOW_LIVE_SOCIAL_PUBLISH), a selected destination, and a connected token.
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
      | "no_destination"
      | "not_connected"
      | "instagram_requires_media"
      | "publish_failed"
  ) {
    super(`meta_publish_refused:${reason}`);
    this.name = "MetaPublishGateError";
  }
}

export interface MetaPublishResult {
  ok: true;
  platform_post_id: string;
}

// Throw a redacted MetaPublishGateError('publish_failed') for a non-2xx Graph
// response. The token is never part of the message; we surface only the label,
// HTTP status, and Meta's own (non-secret) error string when present.
async function graphFail(label: string, resp: Response): Promise<never> {
  let detail = "";
  try {
    const body = (await resp.json()) as { error?: { message?: string } | string };
    const msg = typeof body.error === "string" ? body.error : body.error?.message;
    if (msg) detail = `: ${msg}`;
  } catch {
    // non-JSON error body — status alone is enough
  }
  // Surface the underlying reason via the Error message; the gate reason stays
  // the generic publish_failed so callers can branch on it.
  const err = new MetaPublishGateError("publish_failed");
  err.message = `meta ${label} failed (http ${resp.status})${detail}`;
  throw err;
}

// Resolve the Page access token for a Facebook/Instagram destination using the
// signed-in user's user-access token. IG publishing also requires the linked
// Page's token, so this is shared. Never logs the token.
async function getPageAccessToken(userToken: string, pageId: string): Promise<string> {
  const url = new URL(`${GRAPH_API_BASE}/${encodeURIComponent(pageId)}`);
  url.searchParams.set("fields", "access_token");
  url.searchParams.set("access_token", userToken);
  const resp = await fetch(url.toString());
  if (!resp.ok) await graphFail("page.token", resp);
  const json = (await resp.json().catch(() => ({}))) as { access_token?: string };
  if (!json.access_token) {
    const err = new MetaPublishGateError("publish_failed");
    err.message = "meta page.token failed: no page access_token returned";
    throw err;
  }
  return json.access_token;
}

/**
 * Direct Graph-API publisher — REAL, per-user, and fail-closed.
 *
 * Refuses (throws MetaPublishGateError) unless:
 *   1. detectMetaConfig().configured                       (env present)
 *   2. ctx.is_publish_enabled === true                     (owner/user switch)
 *   3. ALLOW_LIVE_SOCIAL_PUBLISH is on                     (server master switch)
 *   4. the user has a SELECTED destination for the surface (no_destination)
 *   5. the user has a connected Facebook token              (not_connected)
 *
 * Targets the SIGNED-IN USER's own Facebook Page / Instagram business account
 * (per-user destination + per-user token). Facebook posts go to the Page feed
 * (or /photos for an image, /videos for a video) using the Page access token
 * derived from the user token. Instagram publishing is the two-step
 * media -> media_publish flow against the linked IG business account.
 *
 * Never logs, echoes, or returns any token.
 */
export async function publishToMeta(
  post: MetaPublishPost,
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

  const userId = ctx.actor?.id;
  if (!userId) {
    throw new MetaPublishGateError("not_connected");
  }

  const isInstagram = post.surface === "instagram";
  const platform = isInstagram ? "instagram" : "facebook";

  const auditFail = async (reason: string) => {
    await recordIntegrationAudit({
      actor: ctx.actor ?? null,
      action: "meta_publish_failed",
      provider: "meta",
      target_type: "social_post",
      target_id: post.connection_id ?? null,
      metadata: { surface: platform, reason },
    });
  };

  try {
    // Gate 4: selected destination (per-user).
    const destResult = await getSelectedDestination(userId, platform);
    if (!destResult.ok) {
      await auditFail("no_destination");
      throw new MetaPublishGateError("no_destination");
    }
    const destination = destResult.destination;

    // Gate 5: per-user Facebook token.
    const tokenResult = await getUserAccessToken(userId, "facebook");
    if (!tokenResult.ok) {
      await auditFail(tokenResult.reason);
      throw new MetaPublishGateError("not_connected");
    }
    const userToken = tokenResult.accessToken;

    const message = post.message ?? "";

    let platformPostId: string;

    if (isInstagram) {
      // Instagram: needs a media URL. Two-step container -> publish.
      const mediaUrl = post.image_url ?? post.video_url ?? null;
      if (!mediaUrl) {
        await auditFail("instagram_requires_media");
        throw new MetaPublishGateError("instagram_requires_media");
      }

      const igId =
        destination.destination_ref ??
        (typeof destination.metadata?.instagram_business_account_id === "string"
          ? (destination.metadata.instagram_business_account_id as string)
          : null);
      if (!igId) {
        await auditFail("no_destination");
        throw new MetaPublishGateError("no_destination");
      }

      // IG publishing uses the linked Page's token. Resolve it from the Page id
      // when we have one; otherwise fall back to the user token.
      const pageId =
        destination.page_id ??
        (typeof destination.metadata?.facebook_page_id === "string"
          ? (destination.metadata.facebook_page_id as string)
          : null);
      const igToken = pageId ? await getPageAccessToken(userToken, pageId) : userToken;

      // Step 1: create the media container.
      const createUrl = new URL(`${GRAPH_API_BASE}/${encodeURIComponent(igId)}/media`);
      const isVideo = !post.image_url && Boolean(post.video_url);
      const createBody = new URLSearchParams({ access_token: igToken });
      if (isVideo) {
        createBody.set("media_type", "REELS");
        createBody.set("video_url", mediaUrl);
      } else {
        createBody.set("image_url", mediaUrl);
      }
      if (message) createBody.set("caption", message);
      const createResp = await fetch(createUrl.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: createBody.toString(),
      });
      if (!createResp.ok) await graphFail("ig.media.create", createResp);
      const createJson = (await createResp.json().catch(() => ({}))) as { id?: string };
      const creationId = createJson.id;
      if (!creationId) {
        const err = new MetaPublishGateError("publish_failed");
        err.message = "meta ig.media.create failed: no creation id returned";
        throw err;
      }

      // Step 2: publish the container.
      const publishUrl = new URL(`${GRAPH_API_BASE}/${encodeURIComponent(igId)}/media_publish`);
      const publishResp = await fetch(publishUrl.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ creation_id: creationId, access_token: igToken }).toString(),
      });
      if (!publishResp.ok) await graphFail("ig.media.publish", publishResp);
      const publishJson = (await publishResp.json().catch(() => ({}))) as { id?: string };
      if (!publishJson.id) {
        const err = new MetaPublishGateError("publish_failed");
        err.message = "meta ig.media.publish failed: no media id returned";
        throw err;
      }
      platformPostId = publishJson.id;
    } else {
      // Facebook Page post. Resolve the Page id + Page access token.
      const pageId = destination.page_id ?? destination.destination_ref;
      if (!pageId) {
        await auditFail("no_destination");
        throw new MetaPublishGateError("no_destination");
      }
      const pageToken = await getPageAccessToken(userToken, pageId);

      let endpoint: string;
      const body = new URLSearchParams({ access_token: pageToken });
      if (post.image_url) {
        endpoint = `${GRAPH_API_BASE}/${encodeURIComponent(pageId)}/photos`;
        body.set("url", post.image_url);
        if (message) body.set("caption", message);
      } else if (post.video_url) {
        endpoint = `${GRAPH_API_BASE}/${encodeURIComponent(pageId)}/videos`;
        body.set("file_url", post.video_url);
        if (message) body.set("description", message);
      } else {
        endpoint = `${GRAPH_API_BASE}/${encodeURIComponent(pageId)}/feed`;
        body.set("message", message);
      }

      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      if (!resp.ok) await graphFail("page.publish", resp);
      const json = (await resp.json().catch(() => ({}))) as {
        id?: string;
        post_id?: string;
      };
      const id = json.post_id ?? json.id;
      if (!id) {
        const err = new MetaPublishGateError("publish_failed");
        err.message = "meta page.publish failed: no post id returned";
        throw err;
      }
      platformPostId = id;
    }

    await recordIntegrationAudit({
      actor: ctx.actor ?? null,
      action: "meta_published",
      provider: "meta",
      target_type: "social_post",
      target_id: post.connection_id ?? null,
      metadata: {
        surface: platform,
        platform_post_id: platformPostId,
        has_image: Boolean(post.image_url),
        has_video: Boolean(post.video_url),
      },
    });

    return { ok: true, platform_post_id: platformPostId };
  } catch (err) {
    if (err instanceof MetaPublishGateError) {
      // Gate failures already audited above (or are pre-network refusals); the
      // network-failure path records here so every failure leaves a trail.
      if (err.reason === "publish_failed") {
        await auditFail(err.message);
      }
      throw err;
    }
    const message = err instanceof Error ? err.message : "publish_failed";
    await auditFail(message);
    const wrapped = new MetaPublishGateError("publish_failed");
    wrapped.message = message;
    throw wrapped;
  }
}

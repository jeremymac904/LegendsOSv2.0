// Meta (Facebook / Instagram) connector — DISABLED-by-default stub.
//
// This module intentionally performs ZERO outbound calls to Meta. It exists
// so that the rest of the app (Social Studio, /api/integrations/status) can
// report a clean "configured / paid_enabled" state when the env wiring is in
// place, without us actually publishing anything until paid publishing is
// approved by the owner.
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

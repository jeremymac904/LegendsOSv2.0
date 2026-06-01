// Server-only Google Business Profile (GBP) publisher.
// ---------------------------------------------------------------------------
// Tokens are stored in oauth_token_grants (provider='google_business_profile')
// and refreshed transparently via ensureFreshAccessToken. Location targeting
// requires two env vars: GBP_ACCOUNT_ID and GBP_LOCATION_ID.
// Tokens are ONLY placed in the Authorization header — never logged.
// Server-only: never import from a client component.

import { recordIntegrationAudit } from "@/lib/integrations/audit";
import { ensureFreshAccessToken } from "@/lib/integrations/google";
import { getTokenGrant } from "@/lib/integrations/tokenStore";

const GBP_API_BASE = "https://mybusiness.googleapis.com/v4";
const PROVIDER = "google_business_profile";

// ---------------------------------------------------------------------------
// isGbpConnected — presence check only (no live probe).
// ---------------------------------------------------------------------------

/**
 * Returns true when a 'google_business_profile' OAuth token grant exists.
 * Does NOT make a live API call.
 */
export async function isGbpConnected(userId: string): Promise<boolean> {
  try {
    const grant = await getTokenGrant(userId, PROVIDER);
    return Boolean(grant?.access_token);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// createGbpPost — publish a local post to a GBP location.
// ---------------------------------------------------------------------------

export type GbpCallToActionType =
  | "BOOK"
  | "ORDER"
  | "SHOP"
  | "LEARN_MORE"
  | "SIGN_UP"
  | "CALL";

export interface GbpCallToAction {
  actionType: GbpCallToActionType;
  url?: string;
}

export interface GbpPostInput {
  summary: string;
  callToAction?: GbpCallToAction;
  mediaUrl?: string;
  /** 'STANDARD' | 'EVENT' | 'OFFER' | 'ALERT' (default: 'STANDARD') */
  topicType?: "STANDARD" | "EVENT" | "OFFER" | "ALERT";
  /** For audit trail — caller-supplied social_posts.id or similar. */
  social_post_id?: string;
}

export interface GbpPostResult {
  ok: boolean;
  postName?: string;
  message: string;
}

/**
 * Publish a local post to the GBP location configured in env.
 *
 * Returns { ok: false, message: 'not_connected' } when the user has no token.
 * Returns { ok: false, message: 'needs_setup' } when GBP_ACCOUNT_ID or
 * GBP_LOCATION_ID are not configured in the environment.
 * Never logs the access token.
 */
export async function createGbpPost(
  userId: string,
  input: GbpPostInput
): Promise<GbpPostResult> {
  // Check env targeting vars before touching the token
  const accountId = (process.env.GBP_ACCOUNT_ID ?? "").trim();
  const locationId = (process.env.GBP_LOCATION_ID ?? "").trim();

  if (!accountId || !locationId) {
    return {
      ok: false,
      message: "needs_setup: GBP_ACCOUNT_ID and GBP_LOCATION_ID must be set",
    };
  }

  const tokenResult = await ensureFreshAccessToken(userId, PROVIDER);
  if (!tokenResult.ok) {
    return {
      ok: false,
      message:
        tokenResult.reason === "not_connected"
          ? "not_connected"
          : tokenResult.reason === "needs_reauth"
          ? "needs_reauth"
          : "token_unavailable",
    };
  }

  const accessToken = tokenResult.accessToken;

  try {
    // Build the localPost payload per the GBP API spec
    const localPost: Record<string, unknown> = {
      summary: input.summary,
      topicType: input.topicType ?? "STANDARD",
      languageCode: "en",
    };

    if (input.callToAction) {
      localPost.callToAction = {
        actionType: input.callToAction.actionType,
        ...(input.callToAction.url ? { url: input.callToAction.url } : {}),
      };
    }

    if (input.mediaUrl) {
      localPost.media = [
        {
          mediaFormat: "PHOTO",
          sourceUrl: input.mediaUrl,
        },
      ];
    }

    const endpoint = `${GBP_API_BASE}/accounts/${encodeURIComponent(
      accountId
    )}/locations/${encodeURIComponent(locationId)}/localPosts`;

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(localPost),
    });

    const json = (await resp.json().catch(() => ({}))) as {
      name?: string;
      error?: { message?: string; code?: number };
    };

    if (!resp.ok || !json.name) {
      const msg = json.error?.message ?? `http ${resp.status}`;
      throw new Error(`gbp localPosts create failed: ${msg}`);
    }

    // Audit success
    await recordIntegrationAudit({
      actor: null,
      action: "gbp_published",
      provider: PROVIDER,
      target_type: "social_post",
      target_id: input.social_post_id ?? null,
      metadata: {
        post_name: json.name,
        topic_type: input.topicType ?? "STANDARD",
        has_cta: Boolean(input.callToAction),
        has_media: Boolean(input.mediaUrl),
      },
    });

    return { ok: true, postName: json.name, message: "published" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "publish_failed";

    // Audit failure — never include the token
    await recordIntegrationAudit({
      actor: null,
      action: "gbp_publish_failed",
      provider: PROVIDER,
      target_type: "social_post",
      target_id: input.social_post_id ?? null,
      metadata: { error: message },
    });

    return { ok: false, message };
  }
}

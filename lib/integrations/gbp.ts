// Server-only Google Business Profile (GBP) publisher.
// ---------------------------------------------------------------------------
// The signed-in user's OWN token is read from the per-user secret vault via
// ensureFreshAccessToken (provider 'google_business_profile' maps to the shared
// 'google_social' grant). Location targeting uses the user's SELECTED GBP
// destination (social_account_connections) — its destination_ref is the GBP
// location resource name. No env GBP_ACCOUNT_ID / GBP_LOCATION_ID is used.
// Tokens are ONLY placed in the Authorization header — never logged.
// Server-only: never import from a client component.

import { recordIntegrationAudit } from "@/lib/integrations/audit";
import { getSelectedDestination } from "@/lib/integrations/destinations";
import { ensureFreshAccessToken } from "@/lib/integrations/google";

const GBP_API_BASE = "https://mybusiness.googleapis.com/v4";
const PROVIDER = "google_business_profile";

// ---------------------------------------------------------------------------
// isGbpConnected — presence check only (no live probe).
// ---------------------------------------------------------------------------

/**
 * Returns true when the user has a usable GBP token in the vault.
 * Does NOT make a live API call beyond a possible token refresh.
 */
export async function isGbpConnected(userId: string): Promise<boolean> {
  try {
    const result = await ensureFreshAccessToken(userId, PROVIDER);
    return result.ok;
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
 * Publish a local post to the user's SELECTED GBP location.
 *
 * Returns { ok: false, message: 'not_connected' } when the user has no token.
 * Returns { ok: false, message: 'no_destination' } when the user has not
 * selected a GBP location destination. Never logs the access token.
 */
export async function createGbpPost(
  userId: string,
  input: GbpPostInput
): Promise<GbpPostResult> {
  // Resolve the user's selected GBP destination before touching the token.
  const destResult = await getSelectedDestination(userId, PROVIDER);
  if (!destResult.ok) {
    return { ok: false, message: "no_destination" };
  }
  // destination_ref is the GBP location resource name, e.g. 'locations/123' or
  // 'accounts/x/locations/y'. page_id mirrors it on older rows.
  const locationResource = (
    destResult.destination.destination_ref ?? destResult.destination.page_id ?? ""
  ).trim();
  if (!locationResource) {
    return { ok: false, message: "no_destination" };
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

    // locationResource is a full GBP resource name ('accounts/x/locations/y' or
    // 'locations/y'); encode each segment but keep the path separators.
    const encodedResource = locationResource
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    const endpoint = `${GBP_API_BASE}/${encodedResource}/localPosts`;

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
        location_resource: locationResource,
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

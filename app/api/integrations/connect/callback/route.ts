import { NextResponse } from "next/server";

import { isAdminOrOwner } from "@/lib/permissions";
import {
  encryptSecret,
  readOAuthState,
} from "@/lib/integrations/oauth";
import {
  getCurrentProfile,
  getSupabaseServiceClient,
} from "@/lib/supabase/server";
import { recordAudit } from "@/lib/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProviderId =
  | "facebook"
  | "google_social"
  | "google"
  | "gmail"
  | "google_drive"
  | "google_calendar";

interface FacebookPage {
  id: string;
  name: string;
  access_token?: string;
  instagram_business_account?: {
    id?: string;
    name?: string;
    username?: string;
  } | null;
}

interface FacebookAccountsResponse {
  data?: FacebookPage[];
  error?: { message?: string };
}

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface GoogleUserInfo {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
}

interface GoogleBusinessAccount {
  name?: string;
  accountName?: string;
  type?: string;
  permissionLevel?: string;
}

interface GoogleBusinessAccountListResponse {
  accounts?: GoogleBusinessAccount[];
  error?: { message?: string };
}

interface GoogleBusinessLocation {
  name?: string;
  title?: string;
  storeCode?: string;
  primaryPhone?: string;
  metadata?: Record<string, unknown>;
}

interface GoogleBusinessLocationListResponse {
  locations?: GoogleBusinessLocation[];
  nextPageToken?: string;
  error?: { message?: string };
}

interface YouTubeChannelItem {
  id?: string;
  snippet?: {
    title?: string;
    customUrl?: string;
  };
}

interface YouTubeChannelListResponse {
  items?: YouTubeChannelItem[];
  error?: { message?: string };
}

interface DestinationOption {
  platform: "facebook" | "instagram" | "google_business_profile" | "youtube";
  destination_type: string;
  destination_ref: string;
  destination_label: string;
  account_ref?: string | null;
  page_id?: string | null;
  metadata?: Record<string, unknown>;
}

interface GoogleSocialDiscoverySummary {
  apis_called: {
    google_business_accounts: boolean;
    google_business_locations: number;
    youtube_channels: boolean;
  };
  counts: {
    google_business_accounts: number;
    google_business_locations: number;
    youtube_channels: number;
  };
  errors: Array<{ api: string; message: string }>;
}

interface GoogleSocialDiscoveryResult {
  destinations: DestinationOption[];
  summary: GoogleSocialDiscoverySummary;
}

function providerFromState(rawState: string | null): {
  provider: ProviderId;
  targetUserId: string;
  returnTo?: string;
} | null {
  if (!rawState) return null;
  const state = readOAuthState(rawState);
  if (!state) return null;
  if (
    state.provider !== "facebook" &&
    state.provider !== "google_social" &&
    state.provider !== "google" &&
    state.provider !== "gmail" &&
    state.provider !== "google_drive" &&
    state.provider !== "google_calendar"
  ) {
    return null;
  }
  return {
    provider: state.provider as ProviderId,
    targetUserId: state.target_user_id,
    returnTo: state.return_to,
  };
}

function redirectBack(
  origin: string,
  params: Record<string, string | null | undefined>,
  returnTo?: string | null
): NextResponse {
  const safeReturnTo = sanitizeReturnTo(origin, returnTo);
  const url = new URL(safeReturnTo, origin);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

function sanitizeReturnTo(origin: string, returnTo: string | null | undefined): string {
  if (!returnTo) return "/settings";
  const candidate = returnTo.trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return "/settings";

  try {
    const parsed = new URL(candidate, origin);
    if (parsed.origin !== origin) return "/settings";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/settings";
  }
}

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const payload = (await response.json().catch(() => null)) as T | null;
  if (!response.ok) {
    const maybe = payload as
      | { error_description?: string; error?: { message?: string } | string }
      | null;
    const message =
      maybe?.error_description ??
      (typeof maybe?.error === "string"
        ? maybe.error
        : maybe?.error?.message ?? `Request failed (${response.status})`);
    throw new Error(message);
  }
  if (!payload) throw new Error(`Empty response from ${input}`);
  return payload;
}

async function exchangeGoogleToken(code: string, redirectUri: string) {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  return fetchJson<GoogleTokenResponse>("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
}

async function exchangeFacebookToken(code: string, redirectUri: string) {
  const shortUrl = new URL("https://graph.facebook.com/v22.0/oauth/access_token");
  shortUrl.searchParams.set("client_id", process.env.META_APP_ID ?? "");
  shortUrl.searchParams.set("client_secret", process.env.META_APP_SECRET ?? "");
  shortUrl.searchParams.set("redirect_uri", redirectUri);
  shortUrl.searchParams.set("code", code);

  const shortToken = await fetchJson<GoogleTokenResponse>(shortUrl.toString());
  const initialToken = shortToken.access_token ?? "";
  if (!initialToken) {
    throw new Error("Facebook did not return an access token.");
  }

  const longUrl = new URL("https://graph.facebook.com/v22.0/oauth/access_token");
  longUrl.searchParams.set("grant_type", "fb_exchange_token");
  longUrl.searchParams.set("client_id", process.env.META_APP_ID ?? "");
  longUrl.searchParams.set("client_secret", process.env.META_APP_SECRET ?? "");
  longUrl.searchParams.set("fb_exchange_token", initialToken);

  try {
    const longToken = await fetchJson<GoogleTokenResponse>(longUrl.toString());
    return longToken.access_token ? { ...longToken, access_token: longToken.access_token } : shortToken;
  } catch {
    return shortToken;
  }
}

async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo | null> {
  try {
    return await fetchJson<GoogleUserInfo>("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    return null;
  }
}

async function fetchFacebookPages(accessToken: string): Promise<DestinationOption[]> {
  const url = new URL("https://graph.facebook.com/v22.0/me/accounts");
  url.searchParams.set(
    "fields",
    "id,name,instagram_business_account{id,name,username}"
  );
  url.searchParams.set("access_token", accessToken);
  const response = await fetchJson<FacebookAccountsResponse>(url.toString());
  const pages = response.data ?? [];

  const pageDestinations: DestinationOption[] = [];
  const instagramSeen = new Set<string>();
  const instagramDestinations: DestinationOption[] = [];

  for (const page of pages) {
    pageDestinations.push({
      platform: "facebook",
      destination_type: "facebook_page",
      destination_ref: page.id,
      destination_label: page.name,
      account_ref: page.name,
      page_id: page.id,
      metadata: {
        page_name: page.name,
        instagram_business_account_id: page.instagram_business_account?.id ?? null,
        instagram_business_account_username:
          page.instagram_business_account?.username ?? null,
      },
    });

    const ig = page.instagram_business_account;
    if (ig?.id && !instagramSeen.has(ig.id)) {
      instagramSeen.add(ig.id);
      instagramDestinations.push({
        platform: "instagram",
        destination_type: "instagram_account",
        destination_ref: ig.id,
        destination_label: ig.username ?? ig.name ?? page.name,
        account_ref: ig.username ?? ig.name ?? page.name,
        page_id: page.id,
        metadata: {
          facebook_page_id: page.id,
          facebook_page_name: page.name,
          instagram_username: ig.username ?? null,
        },
      });
    }
  }

  return [...pageDestinations, ...instagramDestinations];
}

function safeErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "request_failed";
}

async function fetchGoogleSocialDestinations(
  accessToken: string
): Promise<GoogleSocialDiscoveryResult> {
  const destinations: DestinationOption[] = [];
  const summary: GoogleSocialDiscoverySummary = {
    apis_called: {
      google_business_accounts: false,
      google_business_locations: 0,
      youtube_channels: false,
    },
    counts: {
      google_business_accounts: 0,
      google_business_locations: 0,
      youtube_channels: 0,
    },
    errors: [],
  };

  let businessAccounts: GoogleBusinessAccount[] = [];
  try {
    summary.apis_called.google_business_accounts = true;
    const accounts = await fetchJson<GoogleBusinessAccountListResponse>(
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    businessAccounts = accounts.accounts ?? [];
  } catch (err) {
    summary.errors.push({
      api: "google_business_accounts",
      message: safeErrorMessage(err),
    });
  }

  for (const account of businessAccounts) {
    if (!account.name) continue;

    destinations.push({
      platform: "google_business_profile",
      destination_type: "google_business_account",
      destination_ref: account.name,
      destination_label: account.accountName ?? account.name,
      account_ref: account.accountName ?? account.name,
      metadata: {
        account_name: account.name,
        account_type: account.type ?? null,
        permission_level: account.permissionLevel ?? null,
      },
    });

    try {
      summary.apis_called.google_business_locations += 1;
      const locations = await fetchJson<GoogleBusinessLocationListResponse>(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?pageSize=100`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      for (const location of locations.locations ?? []) {
        if (!location.name) continue;
        destinations.push({
          platform: "google_business_profile",
          destination_type: "google_business_location",
          destination_ref: location.name,
          destination_label: location.title ?? location.name,
          account_ref: account.accountName ?? account.name,
          page_id: location.name,
          metadata: {
            account_name: account.name,
            location_title: location.title ?? null,
            store_code: location.storeCode ?? null,
            primary_phone: location.primaryPhone ?? null,
            metadata: location.metadata ?? {},
          },
        });
      }
    } catch (err) {
      summary.errors.push({
        api: "google_business_locations",
        message: safeErrorMessage(err),
      });
      // Keep the account row even if locations are not readable yet.
    }
  }

  try {
    summary.apis_called.youtube_channels = true;
    const channels = await fetchJson<YouTubeChannelListResponse>(
      "https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    for (const channel of channels.items ?? []) {
      if (!channel.id) continue;
      destinations.push({
        platform: "youtube",
        destination_type: "youtube_channel",
        destination_ref: channel.id,
        destination_label: channel.snippet?.title ?? channel.id,
        account_ref: channel.snippet?.title ?? channel.id,
        metadata: {
          channel_title: channel.snippet?.title ?? null,
          custom_url: channel.snippet?.customUrl ?? null,
        },
      });
    }
  } catch (err) {
    summary.errors.push({
      api: "youtube_channels",
      message: safeErrorMessage(err),
    });
    // Keep GBP destinations even if YouTube is not available on the grant.
  }

  summary.counts.google_business_accounts = destinations.filter(
    (destination) =>
      destination.platform === "google_business_profile" &&
      destination.destination_type === "google_business_account"
  ).length;
  summary.counts.google_business_locations = destinations.filter(
    (destination) =>
      destination.platform === "google_business_profile" &&
      destination.destination_type === "google_business_location"
  ).length;
  summary.counts.youtube_channels = destinations.filter(
    (destination) =>
      destination.platform === "youtube" &&
      destination.destination_type === "youtube_channel"
  ).length;

  return { destinations, summary };
}

function scopesFromResponse(
  provider: ProviderId,
  token: GoogleTokenResponse
): string[] {
  const scope = token.scope ?? "";
  if (scope.trim()) {
    return scope
      .split(/\s+/)
      .map((value) => value.trim())
      .filter(Boolean);
  }
  if (provider === "facebook") {
    return [
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_posts",
      "instagram_basic",
      "instagram_content_publish",
      "business_management",
    ];
  }
  if (provider === "google_social") {
    return [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/business.manage",
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/youtube.upload",
    ];
  }
  if (provider === "google") {
    return ["openid", "email", "profile"];
  }
  if (provider === "gmail") {
    return [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.compose",
      "https://www.googleapis.com/auth/gmail.send",
    ];
  }
  if (provider === "google_drive") {
    return ["https://www.googleapis.com/auth/drive"];
  }
  return ["https://www.googleapis.com/auth/calendar.events"];
}

function hasGoogleSocialScopes(scopes: string[]): boolean {
  const socialScopes = new Set([
    "https://www.googleapis.com/auth/business.manage",
    "https://www.googleapis.com/auth/youtube",
    "https://www.googleapis.com/auth/youtube.force-ssl",
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtubepartner",
    "https://www.googleapis.com/auth/youtubepartner-channel-audit",
  ]);
  return scopes.some((scope) => socialScopes.has(scope));
}

function secretPayloadFromToken(
  provider: ProviderId,
  token: GoogleTokenResponse
): string {
  return encryptSecret(
    JSON.stringify({
      provider,
      access_token: token.access_token ?? "",
      refresh_token: token.refresh_token ?? null,
      token_type: token.token_type ?? "bearer",
      expires_in: token.expires_in ?? null,
      scope: token.scope ?? null,
      stored_at: new Date().toISOString(),
    })
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  const state = providerFromState(url.searchParams.get("state"));

  if (error) {
    return redirectBack(origin, {
      integration: state?.provider ?? null,
      error: errorDescription ?? error,
    }, state?.returnTo);
  }

  if (!code || !state) {
    return redirectBack(origin, {
      integration: state?.provider ?? null,
      error: "invalid_oauth_state",
    }, state?.returnTo);
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    const loginUrl = new URL("/login", origin);
    const returnTo = sanitizeReturnTo(origin, state.returnTo);
    loginUrl.searchParams.set("from", returnTo);
    loginUrl.searchParams.set("error", "oauth_unauthenticated");
    loginUrl.searchParams.set("integration", state.provider);
    return NextResponse.redirect(loginUrl);
  }

  if (state.targetUserId !== profile.id && !isAdminOrOwner(profile)) {
    return redirectBack(origin, {
      integration: state.provider,
      error: "forbidden",
    }, state.returnTo);
  }

  const service = getSupabaseServiceClient();
  const redirectUri =
    state.provider === "facebook"
      ? `${origin}/api/integrations/connect/callback`
      : process.env.GOOGLE_OAUTH_REDIRECT_URI ??
        `${origin}/api/integrations/connect/callback`;

  try {
    const now = new Date().toISOString();
    const token = state.provider === "facebook"
      ? await exchangeFacebookToken(code, redirectUri)
      : await exchangeGoogleToken(code, redirectUri);

    if (!token.access_token) {
      throw new Error("OAuth token exchange did not return an access token.");
    }

    const scopes = scopesFromResponse(state.provider, token);
    const metadata: Record<string, unknown> = {};
    let googleSocialMetadata: Record<string, unknown> | null = null;
    let availableDestinations: DestinationOption[] = [];
    let userSummary: Record<string, unknown> = {};
    const shouldSyncGoogleSocial =
      state.provider === "google_social" || hasGoogleSocialScopes(scopes);

    if (state.provider === "facebook") {
      availableDestinations = await fetchFacebookPages(token.access_token);
      metadata.facebook_pages = availableDestinations.filter(
        (destination) => destination.platform === "facebook"
      );
      metadata.instagram_accounts = availableDestinations.filter(
        (destination) => destination.platform === "instagram"
      );
    } else if (shouldSyncGoogleSocial) {
      const discovery = await fetchGoogleSocialDestinations(token.access_token);
      availableDestinations = discovery.destinations;
      googleSocialMetadata = {
        google_business_accounts: availableDestinations.filter(
          (destination) =>
            destination.platform === "google_business_profile" &&
            destination.destination_type === "google_business_account"
        ),
        google_business_locations: availableDestinations.filter(
          (destination) =>
            destination.platform === "google_business_profile" &&
            destination.destination_type === "google_business_location"
        ),
        youtube_channels: availableDestinations.filter(
          (destination) =>
            destination.platform === "youtube" &&
            destination.destination_type === "youtube_channel"
        ),
        google_social_discovery: discovery.summary,
      };
      if (state.provider === "google_social") {
        Object.assign(metadata, googleSocialMetadata);
      }
    }

    if (state.provider !== "facebook") {
      const info = await fetchGoogleUserInfo(token.access_token);
      if (info) {
        userSummary = {
          account_email: info.email ?? null,
          account_name: info.name ?? null,
          subject_id: info.sub ?? null,
          picture: info.picture ?? null,
        };
      }
    }

    if (Object.keys(userSummary).length > 0) {
      metadata.google_account = userSummary;
      if (googleSocialMetadata) {
        googleSocialMetadata.google_account = userSummary;
      }
    }

    if (shouldSyncGoogleSocial && state.provider !== "google_social") {
      metadata.google_social_discovery = googleSocialMetadata?.google_social_discovery;
    }

    const upsertConnection = async (
      provider: ProviderId,
      connectionMetadata: Record<string, unknown>
    ) => {
      const result = await service
        .from("user_integration_connections")
        .upsert(
          {
            user_id: state.targetUserId,
            organization_id: profile.organization_id,
            provider,
            status: "connected",
            scopes,
            connected_at: now,
            last_checked_at: now,
            metadata: connectionMetadata,
          },
          { onConflict: "user_id,provider" }
        )
        .select("id,user_id,provider,status")
        .single();

      if (result.error || !result.data) {
        throw new Error(result.error?.message ?? `Could not save ${provider} connection.`);
      }
      return result.data;
    };

    const upsertSecret = async (
      provider: ProviderId,
      connectionId: string,
      destinationCount: number
    ) => {
      const result = await service
        .from("social_connection_secrets")
        .upsert(
          {
            user_id: state.targetUserId,
            organization_id: profile.organization_id,
            user_integration_connection_id: connectionId,
            provider,
            encrypted_secret: secretPayloadFromToken(provider, token),
            token_type: token.token_type ?? "bearer",
            scopes,
            expires_at:
              typeof token.expires_in === "number"
                ? new Date(Date.now() + token.expires_in * 1000).toISOString()
                : null,
            metadata: {
              stored_at: now,
              provider,
              destination_count: destinationCount,
              access_token_type: token.token_type ?? "bearer",
            },
          },
          { onConflict: "user_integration_connection_id" }
        )
        .select("id")
        .single();

      if (result.error || !result.data) {
        throw new Error(result.error?.message ?? `Could not store ${provider} secret.`);
      }
      return result.data;
    };

    const userIntegration = await upsertConnection(state.provider, metadata);
    await upsertSecret(
      state.provider,
      userIntegration.id,
      state.provider === "facebook" || state.provider === "google_social"
        ? availableDestinations.length
        : 0
    );

    if (shouldSyncGoogleSocial && state.provider !== "google_social") {
      const googleSocialConnection = await upsertConnection(
        "google_social",
        googleSocialMetadata ?? {
          google_business_accounts: [],
          google_business_locations: [],
          youtube_channels: [],
          google_social_discovery: {
            apis_called: {
              google_business_accounts: false,
              google_business_locations: 0,
              youtube_channels: false,
            },
            counts: {
              google_business_accounts: 0,
              google_business_locations: 0,
              youtube_channels: 0,
            },
            errors: [],
          },
        }
      );
      await upsertSecret(
        "google_social",
        googleSocialConnection.id,
        availableDestinations.length
      );
      await recordAudit({
        actor: profile,
        action: "integration_connected",
        target_type: "user_integration_connections",
        target_id: googleSocialConnection.id,
        metadata: {
          provider: "google_social",
          source_provider: state.provider,
          destination_count: availableDestinations.length,
        },
      });
    }

    await recordAudit({
      actor: profile,
      action: "integration_connected",
      target_type: "user_integration_connections",
      target_id: userIntegration.id,
      metadata: {
        provider: state.provider,
        destination_count: availableDestinations.length,
      },
    });

    return redirectBack(origin, {
      integration: shouldSyncGoogleSocial ? "google_social" : state.provider,
      connected: "1",
      success: "1",
    }, state.returnTo);
  } catch (err) {
    return redirectBack(origin, {
      integration: state.provider,
      error: err instanceof Error ? err.message : "oauth_callback_failed",
    }, state.returnTo);
  }
}

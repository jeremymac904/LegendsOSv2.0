import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminOrOwner } from "@/lib/permissions";
import type { IntegrationConnectionStatus } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROVIDERS = [
  "facebook",
  "google_social",
  "google",
  "gmail",
  "google_drive",
  "google_calendar",
] as const;

type ProviderId = (typeof PROVIDERS)[number];

const CONNECTION_LABELS: Record<ProviderId, string> = {
  facebook: "Meta / Facebook",
  google_social: "Google social destinations",
  google: "Google account",
  gmail: "Gmail",
  google_drive: "Google Drive",
  google_calendar: "Google Calendar",
};

const DESTINATION_PLATFORM_LABELS: Record<string, string> = {
  facebook: "Facebook Page",
  instagram: "Instagram business account",
  google_business_profile: "Google Business Profile",
  youtube: "YouTube channel",
};

interface UserIntegrationConnectionRow {
  id: string;
  user_id: string;
  organization_id: string | null;
  provider: string;
  status: IntegrationConnectionStatus;
  scopes: string[];
  connected_at: string | null;
  last_checked_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface SocialAccountConnectionRow {
  id: string;
  organization_id: string | null;
  user_id: string | null;
  user_integration_connection_id: string | null;
  platform: string;
  account_ref: string | null;
  page_id: string | null;
  destination_type: string | null;
  destination_ref: string | null;
  destination_label: string | null;
  status: IntegrationConnectionStatus;
  connected_by: string | null;
  connected_at: string | null;
  last_tested_at: string | null;
  is_publish_enabled: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface TeamConnectionRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  provider: string;
  status: IntegrationConnectionStatus;
  updated_at: string | null;
}

interface TeamDestinationRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  platform: string;
  destination_label: string | null;
  destination_type: string | null;
  status: IntegrationConnectionStatus;
  is_publish_enabled: boolean;
  updated_at: string | null;
}

interface ProviderView {
  provider: ProviderId;
  label: string;
  status: IntegrationConnectionStatus;
  scopes: string[];
  connected_at: string | null;
  last_checked_at: string | null;
  updated_at: string | null;
  metadata: Record<string, unknown>;
  selected_destinations: SocialAccountConnectionRow[];
  available_destinations: Record<string, unknown>;
}

function normalizeStatus(raw: string | null | undefined): IntegrationConnectionStatus {
  switch ((raw ?? "").toLowerCase()) {
    case "connected":
    case "active":
      return "connected";
    case "error":
    case "failed":
      return "error";
    case "revoked":
    case "disabled":
      return "revoked";
    default:
      return "not_connected";
  }
}

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01") return true;
  const msg = (error.message ?? "").toLowerCase();
  return (
    msg.includes("does not exist") ||
    msg.includes("could not find the table") ||
    msg.includes("schema cache")
  );
}

function pickDestinations(metadata: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const raw = metadata[key];
  return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
}

function destinationLabel(row: SocialAccountConnectionRow): string {
  return row.destination_label ?? row.account_ref ?? row.page_id ?? row.destination_ref ?? row.platform;
}

function destinationStatus(row: SocialAccountConnectionRow): IntegrationConnectionStatus {
  return normalizeStatus(row.status);
}

function providerGroups(rows: UserIntegrationConnectionRow[], destinations: SocialAccountConnectionRow[]): ProviderView[] {
  const byProvider = new Map<string, UserIntegrationConnectionRow>();
  for (const row of rows) byProvider.set(row.provider, row);

  return PROVIDERS.map((provider) => {
    const row = byProvider.get(provider);
    const metadata = (row?.metadata ?? {}) as Record<string, unknown>;
    const selected = destinations.filter((destination) => {
      if (provider === "facebook") {
        return destination.platform === "facebook" || destination.platform === "instagram";
      }
      if (provider === "google_social") {
        return (
          destination.platform === "google_business_profile" ||
          destination.platform === "youtube"
        );
      }
      return false;
    });

    const available_destinations =
      provider === "facebook"
        ? {
            facebook_pages: pickDestinations(metadata, "facebook_pages"),
            instagram_accounts: pickDestinations(metadata, "instagram_accounts"),
          }
        : provider === "google_social"
        ? {
            google_business_accounts: pickDestinations(metadata, "google_business_accounts"),
            google_business_locations: pickDestinations(metadata, "google_business_locations"),
            youtube_channels: pickDestinations(metadata, "youtube_channels"),
          }
        : {};

    return {
      provider,
      label: CONNECTION_LABELS[provider],
      status: normalizeStatus(row?.status),
      scopes: row?.scopes ?? [],
      connected_at: row?.connected_at ?? null,
      last_checked_at: row?.last_checked_at ?? null,
      updated_at: row?.updated_at ?? null,
      metadata,
      selected_destinations: selected,
      available_destinations,
    };
  });
}

async function loadTeamProfileNames(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  userIds: string[]
): Promise<Map<string, { full_name: string | null; email: string | null }>> {
  const nameById = new Map<string, { full_name: string | null; email: string | null }>();
  if (userIds.length === 0) return nameById;

  try {
    const { data } = await supabase
      .from("profiles")
      .select("id,full_name,email")
      .in("id", userIds);
    for (const profile of (data ?? []) as Array<{
      id: string;
      full_name: string | null;
      email: string | null;
    }>) {
      nameById.set(profile.id, {
        full_name: profile.full_name,
        email: profile.email,
      });
    }
  } catch {
    // Best-effort name resolution only.
  }

  return nameById;
}

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "Sign in first." },
      { status: 401 }
    );
  }

  const supabase = getSupabaseServerClient();
  let provisioned = true;

  let providerRows: UserIntegrationConnectionRow[] = [];
  let destinationRows: SocialAccountConnectionRow[] = [];
  let team: TeamConnectionRow[] | null = null;
  let teamDestinations: TeamDestinationRow[] | null = null;

  try {
    const { data, error } = await supabase
      .from("user_integration_connections")
      .select("*")
      .eq("user_id", profile.id)
      .in("provider", [...PROVIDERS, "gmail", "google_drive", "google_calendar"]);
    if (error) {
      if (isMissingTable(error)) provisioned = false;
    } else {
      providerRows = (data ?? []) as UserIntegrationConnectionRow[];
    }
  } catch {
    provisioned = false;
  }

  try {
    const { data, error } = await supabase
      .from("social_account_connections")
      .select("*")
      .eq("user_id", profile.id)
      .order("updated_at", { ascending: false });
    if (error) {
      if (isMissingTable(error)) provisioned = false;
    } else {
      destinationRows = (data ?? []) as SocialAccountConnectionRow[];
    }
  } catch {
    provisioned = false;
  }

  const providerCards = providerGroups(providerRows, destinationRows);

  const owner = isAdminOrOwner(profile);
  if (owner) {
    try {
      const { data, error } = await supabase
        .from("user_integration_connections")
        .select("user_id,provider,status,updated_at")
        .order("updated_at", { ascending: false });
      if (error) {
        if (isMissingTable(error)) provisioned = false;
      } else {
        const rows = (data ?? []) as Array<{
          user_id: string;
          provider: string;
          status: string | null;
          updated_at: string | null;
        }>;
        const names = await loadTeamProfileNames(
          supabase,
          Array.from(new Set(rows.map((row) => row.user_id)))
        );
        team = rows.map((row) => ({
          user_id: row.user_id,
          full_name: names.get(row.user_id)?.full_name ?? null,
          email: names.get(row.user_id)?.email ?? null,
          provider: row.provider,
          status: normalizeStatus(row.status),
          updated_at: row.updated_at,
        }));
      }
    } catch {
      provisioned = false;
    }

    try {
      const { data, error } = await supabase
        .from("social_account_connections")
        .select("user_id,platform,destination_label,destination_type,status,is_publish_enabled,updated_at")
        .order("updated_at", { ascending: false });
      if (error) {
        if (isMissingTable(error)) provisioned = false;
      } else {
        const rows = (data ?? []) as Array<{
          user_id: string;
          platform: string;
          destination_label: string | null;
          destination_type: string | null;
          status: string | null;
          is_publish_enabled: boolean;
          updated_at: string | null;
        }>;
        const names = await loadTeamProfileNames(
          supabase,
          Array.from(new Set(rows.map((row) => row.user_id)))
        );
        teamDestinations = rows.map((row) => ({
          user_id: row.user_id,
          full_name: names.get(row.user_id)?.full_name ?? null,
          email: names.get(row.user_id)?.email ?? null,
          platform: row.platform,
          destination_label: row.destination_label,
          destination_type: row.destination_type,
          status: normalizeStatus(row.status),
          is_publish_enabled: row.is_publish_enabled,
          updated_at: row.updated_at,
        }));
      }
    } catch {
      provisioned = false;
    }
  }

  return NextResponse.json({
    ok: true,
    provisioned,
    connections: providerCards,
    destinations: destinationRows.map((row) => ({
      ...row,
      destination_label: destinationLabel(row),
      status: destinationStatus(row),
    })),
    isOwnerOrAdmin: owner,
    team,
    team_destinations: teamDestinations,
  });
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("select_destination"),
    provider: z.enum(["facebook", "google_social"]),
    destination: z.object({
      platform: z.enum(["facebook", "instagram", "google_business_profile", "youtube"]),
      destination_type: z.string().min(1),
      destination_ref: z.string().min(1),
      destination_label: z.string().min(1),
      account_ref: z.string().nullable().optional(),
      page_id: z.string().nullable().optional(),
      metadata: z.record(z.unknown()).optional(),
    }),
  }),
  z.object({
    action: z.literal("set_publish_enabled"),
    destination_id: z.string().uuid(),
    enabled: z.boolean(),
  }),
  z.object({
    action: z.literal("test_destination"),
    destination_id: z.string().uuid(),
  }),
  z.object({
    action: z.literal("revoke_destination"),
    destination_id: z.string().uuid(),
  }),
]);

export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "Sign in first." },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "bad_request",
        message: parsed.error.issues.map((issue) => issue.message).join("; "),
      },
      { status: 400 }
    );
  }

  const supabase = getSupabaseServerClient();
  const action = parsed.data.action;

  if (action === "select_destination") {
    const providerRow = await supabase
      .from("user_integration_connections")
      .select("*")
      .eq("user_id", profile.id)
      .eq("provider", parsed.data.provider)
      .maybeSingle();

    if (!providerRow.data) {
      return NextResponse.json(
        {
          ok: false,
          error: "not_connected",
          message: "Connect the base account first.",
        },
        { status: 409 }
      );
    }
    if (normalizeStatus(providerRow.data.status) !== "connected") {
      return NextResponse.json(
        {
          ok: false,
          error: "not_connected",
          message: "Reconnect the base account before selecting destinations.",
        },
        { status: 409 }
      );
    }

    const dest = parsed.data.destination;
    const { data, error } = await supabase
      .from("social_account_connections")
      .upsert(
        {
          user_id: profile.id,
          organization_id: profile.organization_id,
          user_integration_connection_id: providerRow.data.id,
          platform: dest.platform,
          destination_type: dest.destination_type,
          destination_ref: dest.destination_ref,
          destination_label: dest.destination_label,
          account_ref: dest.account_ref ?? dest.destination_label,
          page_id: dest.page_id ?? dest.destination_ref,
          status: "connected",
          connected_by: profile.id,
          connected_at: new Date().toISOString(),
          is_publish_enabled: false,
          metadata: dest.metadata ?? {},
        },
        {
          onConflict: "user_id,platform,destination_type,destination_ref",
        }
      )
      .select("*")
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        {
          ok: false,
          error: "update_failed",
          message: error?.message ?? "Could not save destination.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      destination: {
        ...data,
        destination_label: destinationLabel(data as SocialAccountConnectionRow),
        status: destinationStatus(data as SocialAccountConnectionRow),
      },
    });
  }

  const destinationId = parsed.data.destination_id;
  const { data: destination, error: destinationError } = await supabase
    .from("social_account_connections")
    .select("*")
    .eq("id", destinationId)
    .maybeSingle();

  if (destinationError || !destination) {
    return NextResponse.json(
      {
        ok: false,
        error: "not_found",
        message: "Destination not found.",
      },
      { status: 404 }
    );
  }

  if (destination.user_id !== profile.id) {
    return NextResponse.json(
      {
        ok: false,
        error: "forbidden",
        message:
          "Only the destination owner can manage this row. Owner/admin can view team status but cannot change a user's destination selection.",
      },
      { status: 403 }
    );
  }

  if (action === "set_publish_enabled") {
    if (parsed.data.enabled && destination.status !== "connected") {
      return NextResponse.json(
        {
          ok: false,
          error: "not_connected",
          message: "Reconnect the destination before enabling publishing.",
        },
        { status: 409 }
      );
    }
    const { data: updated, error } = await supabase
      .from("social_account_connections")
      .update({
        is_publish_enabled: parsed.data.enabled,
      })
      .eq("id", destinationId)
      .select("*")
      .maybeSingle();
    if (error || !updated) {
      return NextResponse.json(
        {
          ok: false,
          error: "update_failed",
          message: error?.message ?? "Could not update publish flag.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({
      ok: true,
      destination: {
        ...updated,
        destination_label: destinationLabel(updated as SocialAccountConnectionRow),
        status: destinationStatus(updated as SocialAccountConnectionRow),
      },
    });
  }

  if (action === "test_destination") {
    if (destination.status !== "connected") {
      return NextResponse.json(
        {
          ok: false,
          error: "not_connected",
          message: "Reconnect the destination before testing it.",
        },
        { status: 409 }
      );
    }
    const { data: updated, error } = await supabase
      .from("social_account_connections")
      .update({
        last_tested_at: new Date().toISOString(),
        status: "connected",
      })
      .eq("id", destinationId)
      .select("*")
      .maybeSingle();
    if (error || !updated) {
      return NextResponse.json(
        {
          ok: false,
          error: "update_failed",
          message: error?.message ?? "Could not record test status.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({
      ok: true,
      destination: {
        ...updated,
        destination_label: destinationLabel(updated as SocialAccountConnectionRow),
        status: destinationStatus(updated as SocialAccountConnectionRow),
      },
    });
  }

  if (action === "revoke_destination") {
    let secretDeleteError: { message?: string } | null = null;
    if (destination.user_integration_connection_id) {
      const { data: siblingRows, error: siblingError } = await supabase
        .from("social_account_connections")
        .select("id,status")
        .eq("user_integration_connection_id", destination.user_integration_connection_id)
        .neq("id", destinationId);

      if (siblingError) {
        return NextResponse.json(
          {
            ok: false,
            error: "update_failed",
            message: siblingError.message ?? "Could not inspect sibling destinations.",
          },
          { status: 500 }
        );
      }

      const hasOtherActiveDestination = (siblingRows ?? []).some(
        (row) => normalizeStatus(row.status) === "connected"
      );
      if (!hasOtherActiveDestination) {
        const { error } = await supabase
          .from("social_connection_secrets")
          .delete()
          .eq("user_integration_connection_id", destination.user_integration_connection_id);
        secretDeleteError = error ?? null;
      }
    }
    const { data: updated, error } = await supabase
      .from("social_account_connections")
      .update({
        status: "revoked",
        is_publish_enabled: false,
      })
      .eq("id", destinationId)
      .select("*")
      .maybeSingle();

    if (secretDeleteError || error || !updated) {
      return NextResponse.json(
        {
          ok: false,
          error: "update_failed",
          message:
            error?.message ??
            secretDeleteError?.message ??
            "Could not revoke destination.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      destination: {
        ...updated,
        destination_label: destinationLabel(updated as SocialAccountConnectionRow),
        status: destinationStatus(updated as SocialAccountConnectionRow),
      },
    });
  }

  return NextResponse.json(
    { ok: false, error: "bad_request", message: "Unsupported action." },
    { status: 400 }
  );
}

import { NextResponse } from "next/server";
import { z } from "zod";

import { PUBLIC_ENV } from "@/lib/env";
import { isOwner } from "@/lib/permissions";
import {
  getCurrentProfile,
  getSupabaseServerClient,
  getSupabaseServiceClient,
} from "@/lib/supabase/server";
import { recordAudit } from "@/lib/usage";
import type { UserRole } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// All user-management writes route through this single endpoint. Each
// payload carries an `action` discriminator so we can branch server-side
// without exposing the Auth Admin API surface to the client.
//
// Server-only side-effects:
//   - Auth Admin createUser, updateUserById, generateLink (Supabase service
//     role key required).
//   - profiles row insert/update via the user's authenticated client (so RLS
//     still applies for read-after-write).
//
// The owner is the only role allowed to call any of these.

const VALID_ROLES: UserRole[] = [
  "owner",
  "admin",
  "loan_officer",
  "processor",
  "coordinator",
  "marketing",
  "viewer",
];

const addUserSchema = z.object({
  action: z.literal("add"),
  email: z.string().email().max(160),
  full_name: z.string().max(160).nullish(),
  role: z.enum([
    "owner",
    "admin",
    "loan_officer",
    "processor",
    "coordinator",
    "marketing",
    "viewer",
  ]),
  // Default OFF (non-emailing). When false (the default) the account is
  // created and a setup link is returned for MANUAL delivery — NO email is
  // sent. Only when an owner explicitly sets this true does Supabase send the
  // invite email via inviteUserByEmail.
  send_invite_email: z.boolean().default(false),
  // Optional owner-set starter password. Never returned to the client.
  temporary_password: z.string().min(8).max(128).optional(),
});

const updateRoleSchema = z.object({
  action: z.literal("update_role"),
  user_id: z.string().uuid(),
  role: z.enum([
    "admin",
    "loan_officer",
    "processor",
    "coordinator",
    "marketing",
    "viewer",
  ]),
});

const setActiveSchema = z.object({
  action: z.literal("set_active"),
  user_id: z.string().uuid(),
  is_active: z.boolean(),
});

const resetPasswordSchema = z.object({
  action: z.literal("reset_password"),
  user_id: z.string().uuid(),
});

const updateProfileSchema = z.object({
  action: z.literal("update_profile"),
  user_id: z.string().uuid(),
  full_name: z.string().max(160).nullish(),
});

const schema = z.discriminatedUnion("action", [
  addUserSchema,
  updateRoleSchema,
  setActiveSchema,
  resetPasswordSchema,
  updateProfileSchema,
]);

export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated", message: "Sign in first." },
      { status: 401 }
    );
  }
  if (!isOwner(profile) || !profile.organization_id) {
    return NextResponse.json(
      { ok: false, error: "forbidden", message: "Owner only." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "bad_request",
        message: parsed.error.issues.map((i) => i.message).join("; "),
      },
      { status: 400 }
    );
  }
  const data = parsed.data;
  const service = getSupabaseServiceClient();
  const supabase = getSupabaseServerClient();

  // Where minted setup/recovery links should land after the token is verified.
  // Prefer the live request origin (handles preview/custom domains) but NEVER
  // emit a localhost / private-host link. An owner running the app locally
  // would otherwise mint a http://localhost:3000 setup/recovery link that the
  // remote invitee can't open (ERR_CONNECTION_REFUSED) — fall back to the
  // configured production app URL in that case. The set-password screen lives
  // OUTSIDE the auth-gated (app) group so a brand-new user can reach it.
  const configuredOrigin = PUBLIC_ENV.APP_URL.replace(/\/$/, "");
  let origin = configuredOrigin;
  try {
    const reqOrigin = new URL(req.url).origin;
    const host = new URL(reqOrigin).hostname.toLowerCase();
    const isLocalHost =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host.endsWith(".local");
    if (!isLocalHost) origin = reqOrigin;
  } catch {
    // Keep the configured production fallback.
  }
  const setPasswordRedirect = `${origin}/auth/set-password`;

  if (data.action === "add") {
    // Don't allow creating new `owner` rows — there's only one owner per org
    // and promotion has to go through promote_owner() so audit logs are
    // captured at the DB level too.
    if (data.role === "owner") {
      return NextResponse.json(
        {
          ok: false,
          error: "bad_request",
          message:
            "Promote an existing user to owner via promote_owner() — not via add.",
        },
        { status: 400 }
      );
    }

    // Create the auth user via Auth Admin API. Owners can optionally set a
    // starter password for a controlled rollout; the password is never logged
    // or returned, and the setup link is still generated for manual delivery.
    const createPayload: {
      email: string;
      email_confirm: boolean;
      user_metadata: { full_name: string | null };
      password?: string;
    } = {
      email: data.email,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name ?? null,
      },
    };
    if (data.temporary_password) {
      createPayload.password = data.temporary_password;
    }
    const { data: created, error: createErr } =
      await service.auth.admin.createUser(createPayload);
    if (createErr || !created.user) {
      return NextResponse.json(
        {
          ok: false,
          error: "create_failed",
          message: createErr?.message ?? "Could not create the auth user.",
        },
        { status: 500 }
      );
    }

    // Upsert the profile row. The bootstrap trigger creates one automatically
    // on auth.user insert; we update it here so role/full_name/org are right.
    await service
      .from("profiles")
      .update({
        organization_id: profile.organization_id,
        role: data.role,
        full_name: data.full_name ?? null,
        is_active: true,
      })
      .eq("id", created.user.id);

    // Invite delivery — two explicit, non-overlapping paths:
    //
    //   send_invite_email === false  (DEFAULT, non-emailing):
    //     generateLink() only MINTS a link and returns it. Supabase does NOT
    //     send any email for the generateLink call, so the owner can deliver
    //     the setup link manually (copy from the response). This is the safe
    //     default for production rollout.
    //
    //   send_invite_email === true   (explicit opt-in):
    //     inviteUserByEmail() sends Supabase's transactional invite email AND
    //     returns the same action_link for reference. This path only runs when
    //     the caller explicitly sets the flag true.
    //
    // We never fall through to the emailing path by accident: the default is
    // false at the schema level and the branch below is gated on `=== true`.
    let invite_link: string | null = null;
    let email_sent = false;

    if (data.send_invite_email === true) {
      try {
        const { error: inviteErr } =
          await service.auth.admin.inviteUserByEmail(data.email);
        if (inviteErr) throw inviteErr;
        email_sent = true;
        // inviteUserByEmail confirms the invite was queued; mint a setup link
        // too so the owner has a copyable fallback if the email bounces. The
        // link lands on /auth/set-password after the token is verified.
        const { data: linkData } = await service.auth.admin.generateLink({
          type: "magiclink",
          email: data.email,
          options: { redirectTo: setPasswordRedirect },
        });
        invite_link = linkData?.properties?.action_link ?? null;
      } catch (e) {
        console.warn("inviteUserByEmail failed", e);
        // Fall back to a copyable link so the account is still usable even if
        // the email send failed — but report honestly that no email went out.
        email_sent = false;
        try {
          const { data: linkData } = await service.auth.admin.generateLink({
            type: "magiclink",
            email: data.email,
            options: { redirectTo: setPasswordRedirect },
          });
          invite_link = linkData?.properties?.action_link ?? null;
        } catch (e2) {
          console.warn("generateLink fallback failed", e2);
        }
      }
    } else {
      // Non-emailing default: mint a setup link only. No email is sent. The
      // link lands on /auth/set-password after the token is verified.
      try {
        const { data: linkData } = await service.auth.admin.generateLink({
          type: "magiclink",
          email: data.email,
          options: { redirectTo: setPasswordRedirect },
        });
        invite_link = linkData?.properties?.action_link ?? null;
      } catch (e) {
        console.warn("generateLink failed", e);
      }
    }

    await recordAudit({
      actor: profile,
      action: "user_added",
      target_type: "profiles",
      target_id: created.user.id,
      metadata: {
        email: data.email,
        role: data.role,
        temporary_password_set: Boolean(data.temporary_password),
        invite_email_sent: email_sent,
      },
    });

    return NextResponse.json({
      ok: true,
      user: { id: created.user.id, email: data.email, role: data.role },
      invite_link,
      email_sent,
    });
  }

  if (data.action === "update_role") {
    if (data.user_id === profile.id) {
      return NextResponse.json(
        {
          ok: false,
          error: "bad_request",
          message: "You can't change your own role from here.",
        },
        { status: 400 }
      );
    }
    if (!VALID_ROLES.includes(data.role)) {
      return NextResponse.json(
        { ok: false, error: "bad_request", message: "Unknown role." },
        { status: 400 }
      );
    }
    // RLS allows the owner to UPDATE profiles; we use the user-scoped client
    // so the change shows up in audit logs under the owner.
    const { error } = await supabase
      .from("profiles")
      .update({ role: data.role })
      .eq("id", data.user_id);
    if (error) {
      return NextResponse.json(
        { ok: false, error: "update_failed", message: error.message },
        { status: 500 }
      );
    }
    await recordAudit({
      actor: profile,
      action: "user_role_changed",
      target_type: "profiles",
      target_id: data.user_id,
      metadata: { new_role: data.role },
    });
    return NextResponse.json({ ok: true });
  }

  if (data.action === "set_active") {
    if (data.user_id === profile.id) {
      return NextResponse.json(
        {
          ok: false,
          error: "bad_request",
          message: "You can't deactivate yourself.",
        },
        { status: 400 }
      );
    }
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: data.is_active })
      .eq("id", data.user_id);
    if (error) {
      return NextResponse.json(
        { ok: false, error: "update_failed", message: error.message },
        { status: 500 }
      );
    }
    // Also revoke the auth ban / restore it via the Admin API so the user
    // can't sign in while inactive. ban_duration='876000h' = ~100 years.
    try {
      await service.auth.admin.updateUserById(data.user_id, {
        ban_duration: data.is_active ? "none" : "876000h",
      });
    } catch (e) {
      console.warn("auth.admin.updateUserById ban failed", e);
    }
    await recordAudit({
      actor: profile,
      action: data.is_active ? "user_reactivated" : "user_deactivated",
      target_type: "profiles",
      target_id: data.user_id,
    });
    return NextResponse.json({ ok: true });
  }

  if (data.action === "reset_password") {
    // Look up email
    const { data: target } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", data.user_id)
      .single();
    if (!target?.email) {
      return NextResponse.json(
        { ok: false, error: "not_found", message: "User not found." },
        { status: 404 }
      );
    }
    let reset_link: string | null = null;
    try {
      const { data: linkData, error: linkErr } =
        await service.auth.admin.generateLink({
          type: "recovery",
          email: target.email,
          options: { redirectTo: setPasswordRedirect },
        });
      if (linkErr) throw linkErr;
      reset_link = linkData?.properties?.action_link ?? null;
    } catch (e) {
      return NextResponse.json(
        {
          ok: false,
          error: "link_failed",
          message: e instanceof Error ? e.message : "Could not create link.",
        },
        { status: 500 }
      );
    }
    await recordAudit({
      actor: profile,
      action: "user_password_reset",
      target_type: "profiles",
      target_id: data.user_id,
    });
    return NextResponse.json({ ok: true, reset_link });
  }

  if (data.action === "update_profile") {
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: data.full_name ?? null })
      .eq("id", data.user_id);
    if (error) {
      return NextResponse.json(
        { ok: false, error: "update_failed", message: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    { ok: false, error: "bad_request", message: "Unknown action." },
    { status: 400 }
  );
}

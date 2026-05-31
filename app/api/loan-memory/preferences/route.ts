/**
 * /api/loan-memory/preferences — per-user AI voice / communication preferences.
 *
 * GET  — return the signed-in user's user_ai_preferences row, or sensible
 *        defaults derived from VOICE_PROFILES when no row exists.
 * PUT  — upsert the signed-in user's row (tone_profile, communication_rules,
 *        approval_required, default_signature, preferred_response_format).
 *
 * AUTH: getCurrentProfile() (401 if absent). Writes use the RLS-respecting
 * server client, which limits every user to their OWN row — and we always set
 * user_id to the caller's id, so there is no way to write someone else's prefs.
 *
 * SAFETY / HARDENING: the user_ai_preferences table may not exist yet (the
 * migration is not applied). Both GET and PUT degrade gracefully — GET returns
 * defaults with `table_missing: true`; PUT returns an honest 503 the UI can
 * surface — instead of crashing. No secrets are returned. No external actions.
 */

import { NextRequest, NextResponse } from "next/server";

import {
  DEFAULT_VOICE_ID,
  getVoice,
  VOICE_PROFILES,
} from "@/lib/loanMemory/voices";
import type { UserAiPreferences } from "@/lib/loanMemory/types";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_RESPONSE_FORMAT = "status_blocker_next";

/** Defaults for a user with no stored row — seeded from their voice profile. */
function defaultsFor(userId: string, voiceId: string) {
  const voice = getVoice(voiceId);
  return {
    user_id: userId,
    tone_profile: voice.id,
    communication_rules: voice.rules,
    approval_required: true,
    default_signature: voice.defaultSignature,
    preferred_response_format: DEFAULT_RESPONSE_FORMAT,
  };
}

/** Heuristic: error shapes that mean "relation does not exist / not applied". */
function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  // 42P01 = undefined_table (Postgres). PGRST205 = PostgREST table not found.
  if (err.code === "42P01" || err.code === "PGRST205") return true;
  const m = (err.message ?? "").toLowerCase();
  return (
    m.includes("does not exist") ||
    m.includes("could not find the table") ||
    m.includes("schema cache")
  );
}

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  // Voice profile catalog is always available (static) so the form can render
  // even before the migration is applied.
  const voices = Object.values(VOICE_PROFILES).map((v) => ({
    id: v.id,
    label: v.label,
    rules: v.rules,
    defaultSignature: v.defaultSignature,
  }));

  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("user_ai_preferences")
      .select("*")
      .eq("user_id", profile.id)
      .maybeSingle();

    if (error) {
      if (isMissingTable(error)) {
        return NextResponse.json({
          ok: true,
          table_missing: true,
          is_default: true,
          preferences: defaultsFor(profile.id, DEFAULT_VOICE_ID),
          voices,
          default_voice_id: DEFAULT_VOICE_ID,
          message:
            "Loan Memory migration not applied yet — showing defaults (sample mode). Saving will be available once the table exists.",
        });
      }
      // Any other read error: still return usable defaults rather than crash.
      return NextResponse.json({
        ok: true,
        is_default: true,
        preferences: defaultsFor(profile.id, DEFAULT_VOICE_ID),
        voices,
        default_voice_id: DEFAULT_VOICE_ID,
        message: "Could not read saved preferences — showing defaults.",
      });
    }

    if (!data) {
      return NextResponse.json({
        ok: true,
        is_default: true,
        preferences: defaultsFor(profile.id, DEFAULT_VOICE_ID),
        voices,
        default_voice_id: DEFAULT_VOICE_ID,
      });
    }

    return NextResponse.json({
      ok: true,
      is_default: false,
      preferences: data as UserAiPreferences,
      voices,
      default_voice_id: DEFAULT_VOICE_ID,
    });
  } catch {
    // Supabase client failed to construct (env absent) — degrade to defaults.
    return NextResponse.json({
      ok: true,
      table_missing: true,
      is_default: true,
      preferences: defaultsFor(profile.id, DEFAULT_VOICE_ID),
      voices,
      default_voice_id: DEFAULT_VOICE_ID,
      message: "Preferences storage unavailable — showing defaults (sample mode).",
    });
  }
}

export async function PUT(req: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Partial<{
    tone_profile: string;
    communication_rules: string | null;
    approval_required: boolean;
    default_signature: string | null;
    preferred_response_format: string;
  }> | null;

  if (!body) {
    return NextResponse.json(
      { ok: false, error: "invalid_body", message: "Expected a JSON body." },
      { status: 400 }
    );
  }

  // Normalize / validate the voice id against the known catalog. An unknown id
  // is treated as "custom" tone (we still store whatever the user typed in the
  // rules field). VOICE_PROFILES ids are the supported presets.
  const toneProfile =
    typeof body.tone_profile === "string" && body.tone_profile.trim()
      ? body.tone_profile.trim()
      : DEFAULT_VOICE_ID;

  const responseFormat =
    typeof body.preferred_response_format === "string" &&
    body.preferred_response_format.trim()
      ? body.preferred_response_format.trim()
      : DEFAULT_RESPONSE_FORMAT;

  const row = {
    user_id: profile.id, // never trust a client-supplied user_id
    tone_profile: toneProfile,
    communication_rules:
      typeof body.communication_rules === "string"
        ? body.communication_rules
        : null,
    approval_required:
      typeof body.approval_required === "boolean" ? body.approval_required : true,
    default_signature:
      typeof body.default_signature === "string" ? body.default_signature : null,
    preferred_response_format: responseFormat,
  };

  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("user_ai_preferences")
      .upsert(row, { onConflict: "user_id" })
      .select("*")
      .maybeSingle();

    if (error) {
      if (isMissingTable(error)) {
        return NextResponse.json(
          {
            ok: false,
            table_missing: true,
            error: "migration_not_applied",
            message:
              "Loan Memory migration not applied yet — preferences can't be saved until the user_ai_preferences table exists.",
          },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { ok: false, error: "save_failed", message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      preferences: (data as UserAiPreferences) ?? { ...row },
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        table_missing: true,
        error: "storage_unavailable",
        message:
          e instanceof Error
            ? e.message
            : "Preferences storage unavailable — could not save.",
      },
      { status: 503 }
    );
  }
}

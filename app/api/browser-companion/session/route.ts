// LegendsOS v2 — Sprint 4 — Browser Companion: session / pairing.
//
// GET  -> { authenticated, user:{id,email,role}, paired } using the existing
//         Supabase auth cookie (token-free). 401 when unauthenticated.
// POST -> { action:'register_device', device_label, user_agent } records a
//         browser_companion_sessions row (best-effort; 42P01 -> still ok with
//         provisioned:false). 401 when unauthenticated.
// OPTIONS -> CORS preflight for the Chrome extension (chrome-extension origin +
//            credentials).
//
// AUTH MODEL: the extension calls with fetch(..., { credentials:'include' }) so
// the user's web-session cookie authenticates them. No token is stored or read.

import { z } from "zod";

import {
  corsJson,
  preflight,
  registerSession,
  type CompanionAssistant,
} from "@/lib/browserCompanion/store";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS(req: Request) {
  return preflight(req);
}

// GET — session probe. Used by the extension on load to decide whether to show
// "signed in" vs "open LegendsOS to sign in". `paired` is true when we have an
// authenticated user (the cookie IS the pairing in the token-free model).
export async function GET(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return corsJson(
      req,
      { authenticated: false, user: null, paired: false },
      401
    );
  }
  return corsJson(req, {
    authenticated: true,
    paired: true,
    user: {
      id: profile.id,
      email: profile.email,
      role: profile.role,
    },
  });
}

const registerSchema = z.object({
  action: z.literal("register_device"),
  device_label: z.string().max(200).optional(),
  user_agent: z.string().max(500).optional(),
  // Non-secret pref the extension may echo back so we know its last assistant.
  last_assistant: z
    .enum(["owner", "loan_officer", "processor", "coordinator"])
    .optional(),
});

// POST — register this browser/device. Best-effort: if the Sprint-4 table is
// not provisioned yet we still return ok with provisioned:false (honest).
export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return corsJson(req, { ok: false, error: "unauthorized" }, 401);
  }

  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return corsJson(
      req,
      {
        ok: false,
        error: "bad_request",
        message: parsed.error.issues.map((i) => i.message).join("; "),
      },
      400
    );
  }

  const userClient = getSupabaseServerClient();
  const result = await registerSession(userClient, {
    user_id: profile.id,
    organization_id: profile.organization_id,
    device_label: parsed.data.device_label ?? null,
    user_agent: parsed.data.user_agent ?? null,
  });

  const lastAssistant: CompanionAssistant | null =
    parsed.data.last_assistant ?? null;

  // Whether or not the table exists, the user IS paired (the cookie is the
  // pairing). provisioned tells the extension if device history is being
  // persisted yet.
  return corsJson(req, {
    ok: true,
    paired: true,
    provisioned: result.provisioned,
    session_id: result.data?.id ?? null,
    last_assistant: lastAssistant,
    user: {
      id: profile.id,
      email: profile.email,
      role: profile.role,
    },
  });
}

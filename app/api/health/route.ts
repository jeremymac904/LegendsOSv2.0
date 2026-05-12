import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    app: "legendsos-v2",
    supabaseConfigured: isSupabaseConfigured(),
    time: new Date().toISOString(),
  });
}

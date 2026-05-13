import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Run on every path except static assets and Next internals.
    // Allow public/ files of common types through without auth. The /assets/*
    // tree (logos, backgrounds, team photos, manifest.json) is intentionally
    // public — adding .json + the explicit /assets prefix keeps it that way.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml|assets/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json|woff2?|ttf|otf|css|js|map|ico|mp4|webm)$).*)",
  ],
};

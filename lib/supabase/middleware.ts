import { NextResponse, type NextRequest } from "next/server";

import { createServerClient, type CookieOptions } from "@supabase/ssr";

import { PUBLIC_ENV, isSupabaseConfigured } from "@/lib/env";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/auth",
  "/api/health",
  "/api/auth",
  "/_next",
  "/favicon.ico",
  "/icon.svg",
  "/robots.txt",
  "/sitemap.xml",
];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true; // marketing/landing redirect handled by page.
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function updateSession(request: NextRequest) {
  // Propagate the current pathname to server components via the request
  // headers. Layouts read it via `headers().get("x-pathname")` to make
  // route-aware rendering decisions (e.g. the Atlas full-bleed layout).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  if (!isSupabaseConfigured()) {
    // Supabase not wired up yet — let the not-configured page render.
    return response;
  }

  const supabase = createServerClient(
    PUBLIC_ENV.SUPABASE_URL,
    PUBLIC_ENV.SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({
            request: { headers: requestHeaders },
          });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // IMPORTANT (per Supabase guidance): do not run other logic between
  // createServerClient and auth.getUser() — that call refreshes the session
  // and sets fresh cookies on `response`.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Logged in but on /login → bounce to dashboard.
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Not logged in and accessing a protected path → behavior depends on whether
  // the caller expects HTML (a page) or JSON (an API route or fetch call).
  //
  // For API routes (or anything that asks for JSON via the Accept header) we
  // MUST return a JSON 401. Returning a 302 to /login causes the browser to
  // follow the redirect, fetch the HTML login page, and then the client tries
  // to `res.json()` on `<!DOCTYPE html>…` and throws:
  //
  //   "Unexpected token '<', \"<HTML><HE\"... is not valid JSON"
  //
  // For everything else (real page navigations), keep the redirect to /login.
  if (!user && !isPublicPath(pathname)) {
    const accept = request.headers.get("accept") ?? "";
    const wantsJson =
      pathname.startsWith("/api/") || accept.includes("application/json");
    if (wantsJson) {
      return NextResponse.json(
        {
          ok: false,
          error: "unauthenticated",
          message: "Please sign in again.",
        },
        { status: 401 }
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

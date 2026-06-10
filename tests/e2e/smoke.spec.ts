import { expect, test } from "@playwright/test";

// Smoke tests run against the booted app. They do NOT require Supabase to be
// configured; they exercise the public surface (health endpoint, setup page,
// login page, redirects).

test("health endpoint responds", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.ok).toBe(true);
  expect(json.app).toBe("legendsos-v2");
});

test("unauthenticated root redirects to login or setup", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  // Either /login (Supabase configured) or /setup (not configured) — both ok.
  const url = page.url();
  expect(url.includes("/login") || url.includes("/setup")).toBe(true);
});

test("login page renders with brand", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveTitle(/LegendsOS/i);
});

const PROTECTED_ROUTE_SMOKE = [
  "/dashboard",
  "/atlas",
  "/flo",
  "/coordinator",
  "/marketing-assistant",
  "/social",
  "/email",
  "/images",
  "/calendar",
  "/knowledge",
  "/training",
  "/browser-companion",
  "/settings",
  "/admin",
  "/admin/connections",
  "/admin/setup",
  "/admin/leads",
  "/admin/n8n",
  "/admin/users",
  "/admin/assets",
] as const;

for (const route of PROTECTED_ROUTE_SMOKE) {
  test(`protected ${route} bounces to login or setup`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState("domcontentloaded");
    const url = page.url();
    expect(url.includes("/login") || url.includes("/setup")).toBe(true);
  });
}

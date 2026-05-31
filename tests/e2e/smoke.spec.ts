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

test("protected dashboard bounces to login", async ({ page }) => {
  await page.goto("/dashboard");
  await page.waitForLoadState("domcontentloaded");
  const url = page.url();
  expect(url.includes("/login") || url.includes("/setup")).toBe(true);
});

test("protected admin bounces to login", async ({ page }) => {
  await page.goto("/admin");
  await page.waitForLoadState("domcontentloaded");
  const url = page.url();
  expect(url.includes("/login") || url.includes("/setup")).toBe(true);
});

// Legends Growth Academy — Phase 1 scaffold.
// Protected routes bounce to /login or /setup when unauthenticated; this
// confirms the new routes register correctly behind middleware.
const ACADEMY_ROUTES = [
  "/training/academy",
  "/training/academy/sales",
  "/training/academy/marketing",
  "/training/academy/ai",
  "/training/academy/mastery",
  "/training/academy/sales/sales-101",
  "/training/scripts",
  "/training/roleplay",
  "/training/audio",
];

for (const route of ACADEMY_ROUTES) {
  test(`protected ${route} bounces to login or setup`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState("domcontentloaded");
    const url = page.url();
    expect(url.includes("/login") || url.includes("/setup")).toBe(true);
  });
}

// Theme system smoke — the boot script must add `.dark` or `.light` to
// <html> before paint, and localStorage must override system preference.
test("theme boot script applies a theme class before paint", async ({
  page,
}) => {
  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");
  const htmlClass = await page.evaluate(() => document.documentElement.className);
  expect(htmlClass === "dark" || htmlClass === "light").toBe(true);
});

test("theme toggle persists to localStorage and survives reload", async ({
  page,
}) => {
  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(() => {
    localStorage.setItem("legendsTheme", "light");
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");
  });
  await page.reload();
  await page.waitForLoadState("domcontentloaded");
  const after = await page.evaluate(() => ({
    htmlClass: document.documentElement.className,
    stored: localStorage.getItem("legendsTheme"),
  }));
  expect(after.stored).toBe("light");
  expect(after.htmlClass).toContain("light");
});

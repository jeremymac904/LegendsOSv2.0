import { expect, test } from "@playwright/test";

// Loan Brain / Drive Browser — Phase 2 scaffold.
// These new routes are role-gated server components: they call
// getEffectiveProfile() and redirect the wrong role to /dashboard, while the
// app layout redirects unauthenticated users to /login. Unauthenticated
// visits therefore bounce to /login (or /setup when Supabase isn't
// configured). This confirms the new routes register correctly behind the
// auth/layout guard, matching the smoke pattern used for the rest of the app.
const LOAN_BRAIN_ROUTES = [
  "/loan-brain",
  "/processing",
  "/coordinator",
  "/my-loans",
];

for (const route of LOAN_BRAIN_ROUTES) {
  test(`protected ${route} bounces to login or setup`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState("domcontentloaded");
    const url = page.url();
    expect(url.includes("/login") || url.includes("/setup")).toBe(true);
  });
}

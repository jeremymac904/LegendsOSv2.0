import { expect, test } from "@playwright/test";

// API auth smoke tests assert the UNAUTHENTICATED security contract for the
// /api/* surface. They require no Supabase auth fixtures: every request below
// is made with no session, and we assert the endpoint fails closed (401/403/503)
// rather than leaking data or 200-ing. We prefer asserting the JSON 401 shape
// for /api/* paths, but tolerate other fail-closed codes where the route's
// design allows it (documented per-test).

test("GET /api/integrations/status is 401 unauthenticated", async ({
  request,
}) => {
  const res = await request.get("/api/integrations/status");
  // Owner-only endpoint; unauthenticated must be 401 with {ok:false}.
  expect(res.status()).toBe(401);
  const json = await res.json();
  expect(json.ok).toBe(false);
  expect(json.error).toBe("unauthenticated");
});

test("GET /api/admin/readiness is 401 unauthenticated", async ({ request }) => {
  const res = await request.get("/api/admin/readiness");
  // Owner/admin-only; unauthenticated must be 401 with {ok:false}.
  expect(res.status()).toBe(401);
  const json = await res.json();
  expect(json.ok).toBe(false);
  expect(json.error).toBe("unauthenticated");
});

test("POST /api/browser-companion/capture is 401 unauthenticated", async ({
  request,
}) => {
  const res = await request.post("/api/browser-companion/capture", {
    data: { task: "summarize this page" },
  });
  // Auth required before any persistence; unauthenticated must be 401.
  expect(res.status()).toBe(401);
  const json = await res.json();
  expect(json.ok).toBe(false);
  expect(json.error).toBe("unauthenticated");
});

test("POST /api/webhooks/email-intake is 401 or 503 without secret", async ({
  request,
}) => {
  const res = await request.post("/api/webhooks/email-intake", {
    data: { source_account: "ops@example.com", gmail_message_id: "abc123" },
  });
  // Fail closed: 401 when the shared secret is configured but missing/wrong on
  // the request, or 503 when the server has no LEGENDSOS_WEBHOOK_SECRET set
  // (intake not provisioned). Either is an acceptable closed door.
  expect([401, 503]).toContain(res.status());
  const json = await res.json();
  expect(json.ok).toBe(false);
});

test("POST /api/automation/callback is 401 without valid signature", async ({
  request,
}) => {
  const res = await request.post("/api/automation/callback", {
    data: { job_id: "00000000-0000-0000-0000-000000000000", ok: true },
  });
  // Fail closed: a callback with no/invalid HMAC signature must be 401 — a
  // forged callback must never be able to flip job/post/email status.
  expect(res.status()).toBe(401);
  const json = await res.json();
  expect(json.ok).toBe(false);
  expect(json.error).toBe("unauthenticated");
});

// Netlify scheduled function — drives the LegendsOS scheduler + retry queue.
//
// Every 5 minutes Netlify invokes this function, which POSTs to the protected
// app route `/api/cron/process-scheduled`. The route does the real work (find
// due social posts / email campaigns, dispatch, retry with backoff). This
// function is a thin, fail-soft trigger: it never throws, so a transient error
// just means the next 5-minute tick tries again.
//
// Required env (set in the Netlify site, NOT committed):
//   * CRON_SECRET — shared secret. Must match the value the app route reads.
//                   Sent as the `x-cron-secret` header. Without it the route
//                   returns 503 and nothing is processed (fail closed).
//   * URL         — provided automatically by Netlify (the site's base URL).
//
// The schedule is declared inline below; no netlify.toml entry is required.

export const config = {
  schedule: "*/5 * * * *",
};

export default async function handler() {
  const base = process.env.URL || "https://legndsosv20.netlify.app";
  const target = `${base.replace(/\/$/, "")}/api/cron/process-scheduled`;
  const secret = process.env.CRON_SECRET || "";

  if (!secret) {
    console.warn(
      "[process-scheduled] CRON_SECRET is not set — scheduler trigger skipped."
    );
    return new Response("CRON_SECRET not configured", { status: 200 });
  }

  try {
    const res = await fetch(target, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-cron-secret": secret,
      },
      body: JSON.stringify({ source: "netlify-scheduled" }),
    });
    const text = await res.text();
    console.log(
      `[process-scheduled] ${res.status} ${text.slice(0, 500)}`
    );
    return new Response(text, { status: 200 });
  } catch (err) {
    // Never throw: a failed trigger must not crash the scheduled invocation.
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[process-scheduled] trigger failed: ${message}`);
    return new Response(`trigger failed: ${message}`, { status: 200 });
  }
}

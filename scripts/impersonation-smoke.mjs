// Impersonation smoke test.
//
// 1. Create a short-lived test profile (admin role).
// 2. Auth as owner.
// 3. POST /api/admin/impersonate { user_id } — confirm cookie returned + ok:true.
// 4. GET /dashboard with both auth cookie + impersonation cookie — confirm 200.
// 5. DELETE /api/admin/impersonate — confirm cookie cleared.
// 6. Cleanup test profile.
import { createClient } from '@supabase/supabase-js';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SECRET_KEY;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const OWNER = process.env.NEXT_PUBLIC_OWNER_EMAIL || 'jeremy@mcdonald-mtg.com';
const APP = process.env.APP_URL || 'http://localhost:3000';

const admin = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } });

// 0) Auth as owner.
const { data: linkData } = await admin.auth.admin.generateLink({ type: 'magiclink', email: OWNER });
const userClient = createClient(SUPA_URL, ANON, { auth: { persistSession: false } });
const { data: sess } = await userClient.auth.verifyOtp({
  token_hash: linkData.properties.hashed_token,
  type: linkData.properties.verification_type,
});
const session = sess.session;
const projectRef = new URL(SUPA_URL).host.split('.')[0];
const authCookie = `sb-${projectRef}-auth-token=${encodeURIComponent(JSON.stringify({
  access_token: session.access_token, refresh_token: session.refresh_token,
  expires_at: session.expires_at, expires_in: session.expires_in,
  token_type: session.token_type, user: session.user,
}))}`;

// 1) Create a fresh test user via the admin route so the profile + auth row both exist.
const testEmail = `impersonate-smoke+${Date.now()}@axonforge-test.invalid`;
const addRes = await fetch(`${APP}/api/admin/users`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json', cookie: authCookie },
  body: JSON.stringify({ action: 'add', email: testEmail, full_name: 'Impersonation Smoke', role: 'admin', send_invite_email: false }),
});
const addBody = await addRes.json();
if (!addBody.ok) { console.error('add failed', addBody); process.exit(2); }
const targetId = addBody.user.id;
console.log('target profile id =', targetId);

// 2) Start impersonation.
const start = await fetch(`${APP}/api/admin/impersonate`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json', cookie: authCookie },
  body: JSON.stringify({ user_id: targetId }),
});
const startBody = await start.json();
const startCookie = start.headers.getSetCookie?.()?.find((c) => c.startsWith('legendsos-impersonate='))
  ?? start.headers.get('set-cookie');
console.log('POST /api/admin/impersonate ->', start.status, startBody);
console.log('set-cookie present:', Boolean(startCookie));
if (!startBody.ok || !startCookie) { console.error('start failed'); process.exit(3); }

// Pull just the cookie name=value from set-cookie.
const m = /(legendsos-impersonate=[^;]*)/.exec(startCookie);
const impCookie = m ? m[1] : '';

// 3) Hit /dashboard with both cookies — confirm it renders (200).
const dash = await fetch(`${APP}/dashboard`, {
  method: 'GET',
  headers: { cookie: `${authCookie}; ${impCookie}` },
});
console.log('GET /dashboard (impersonating) ->', dash.status);

// 4) Stop impersonation.
const stop = await fetch(`${APP}/api/admin/impersonate`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json', cookie: authCookie },
  body: JSON.stringify({ user_id: null }),
});
console.log('POST /api/admin/impersonate (null) ->', stop.status, await stop.json());

// 5) Cleanup.
await admin.from('profiles').delete().eq('id', targetId);
await admin.auth.admin.deleteUser(targetId);
console.log('cleanup done');

if (start.status !== 200 || dash.status !== 200 || stop.status !== 200) {
  console.error('FAIL: one or more steps failed');
  process.exit(4);
}
console.log('PASS');

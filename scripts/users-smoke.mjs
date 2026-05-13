// Users + Roles smoke test.
//
// 1. Auth as owner.
// 2. POST /api/admin/users action=add with email = users-smoke+TS@axonforge-test.invalid
// 3. POST /api/admin/users action=update_role with role=marketing, then admin
// 4. Confirm profile row shows latest role.
// 5. Cleanup: deactivate + delete the test profile + auth user.
import { createClient } from '@supabase/supabase-js';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SECRET_KEY;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const OWNER = process.env.NEXT_PUBLIC_OWNER_EMAIL || 'jeremy@mcdonald-mtg.com';
const APP = process.env.APP_URL || 'http://localhost:3000';

const admin = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } });

const { data: linkData } = await admin.auth.admin.generateLink({ type: 'magiclink', email: OWNER });
const userClient = createClient(SUPA_URL, ANON, { auth: { persistSession: false } });
const { data: sess } = await userClient.auth.verifyOtp({
  token_hash: linkData.properties.hashed_token,
  type: linkData.properties.verification_type,
});
const session = sess.session;
const projectRef = new URL(SUPA_URL).host.split('.')[0];
const cookie = `sb-${projectRef}-auth-token=${encodeURIComponent(JSON.stringify({
  access_token: session.access_token, refresh_token: session.refresh_token,
  expires_at: session.expires_at, expires_in: session.expires_in,
  token_type: session.token_type, user: session.user,
}))}`;

async function post(payload) {
  const r = await fetch(`${APP}/api/admin/users`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', cookie },
    body: JSON.stringify(payload),
  });
  return { status: r.status, body: await r.json() };
}

const testEmail = `users-smoke+${Date.now()}@axonforge-test.invalid`;
const add = await post({ action: 'add', email: testEmail, full_name: 'Role Dropdown Smoke', role: 'loan_officer', send_invite_email: false });
console.log('add ->', add.status, add.body.ok, add.body.user?.id, 'has_invite_link=', Boolean(add.body.invite_link));
if (!add.body.ok) process.exit(2);
const uid = add.body.user.id;

for (const role of ['marketing', 'admin', 'viewer', 'loan_officer']) {
  const r = await post({ action: 'update_role', user_id: uid, role });
  const { data: row } = await admin.from('profiles').select('role').eq('id', uid).single();
  console.log(`update_role(${role}) -> ${r.status} db.role=${row?.role}`);
  if (row?.role !== role) { console.error('role mismatch'); process.exit(3); }
}

// Cleanup: remove profile row + auth user.
await admin.from('profiles').delete().eq('id', uid);
await admin.auth.admin.deleteUser(uid);
console.log('cleanup done');
console.log('PASS');

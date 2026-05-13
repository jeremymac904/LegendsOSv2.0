import { createClient } from '@supabase/supabase-js';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SECRET_KEY;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const OWNER = process.env.NEXT_PUBLIC_OWNER_EMAIL || 'jeremy@mcdonald-mtg.com';
const APP = process.env.APP_URL || 'http://localhost:3000';

const admin = createClient(SUPA_URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: OWNER });
if (error) { console.error('generateLink', error); process.exit(2); }
const user = createClient(SUPA_URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: sess } = await user.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: data.properties.verification_type });
const session = sess.session;

const projectRef = new URL(SUPA_URL).host.split('.')[0];
const cookieName = `sb-${projectRef}-auth-token`;
const cookieValue = encodeURIComponent(JSON.stringify({
  access_token: session.access_token,
  refresh_token: session.refresh_token,
  expires_at: session.expires_at,
  expires_in: session.expires_in,
  token_type: session.token_type,
  user: session.user,
}));

// Build a small in-memory PNG (1x1 transparent) for upload.
const pngB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const pngBytes = Buffer.from(pngB64, 'base64');
const form = new FormData();
form.append('file', new Blob([pngBytes], { type: 'image/png' }), 'smoke-test-1px.png');
form.append('label', 'Atlas smoke 1x1');
form.append('description', 'Automated verification asset, safe to delete.');
form.append('category', 'social_image');
form.append('visibility', 'team_shared');

const r = await fetch(`${APP}/api/admin/assets`, {
  method: 'POST',
  headers: { accept: 'application/json', cookie: `${cookieName}=${cookieValue}` },
  body: form,
});
const j = await r.json();
console.log('POST /api/admin/assets -> HTTP', r.status);
console.log(JSON.stringify(j).slice(0, 800));

if (!j.ok) process.exit(3);
const assetId = j.asset.id;
console.log('asset created id=', assetId);

// LIST: re-fetch via shared_resources directly to confirm visibility, then DELETE.
const userClient = createClient(SUPA_URL, ANON, { auth: { persistSession: false } });
await userClient.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
const { data: rows, error: qErr } = await userClient
  .from('shared_resources')
  .select('id,title,resource_type,payload')
  .eq('id', assetId);
console.log('shared_resources read:', qErr ?? rows?.length, rows?.[0]?.resource_type);

const del = await fetch(`${APP}/api/admin/assets?id=${assetId}`, {
  method: 'DELETE',
  headers: { accept: 'application/json', cookie: `${cookieName}=${cookieValue}` },
});
console.log('DELETE -> HTTP', del.status, await del.text());

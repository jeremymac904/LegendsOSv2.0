// Steps E & F & cleanup against the live deploy.
import { createClient } from '@supabase/supabase-js';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SECRET_KEY;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const OWNER = process.env.NEXT_PUBLIC_OWNER_EMAIL || 'jeremy@mcdonald-mtg.com';
const APP = 'https://legndsosv20.netlify.app';

const admin = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } });
const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email: OWNER });
const user = createClient(SUPA_URL, ANON, { auth: { persistSession: false } });
const { data: sess } = await user.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: link.properties.verification_type });
const s = sess.session;
const projectRef = new URL(SUPA_URL).host.split('.')[0];
const cookie = `sb-${projectRef}-auth-token=${encodeURIComponent(JSON.stringify({
  access_token: s.access_token, refresh_token: s.refresh_token,
  expires_at: s.expires_at, expires_in: s.expires_in,
  token_type: s.token_type, user: s.user,
}))}`;

const MARKER = `agent-system-smoke-${Date.now()}`;
let socialId = null;
let campaignId = null;

console.log('=== STEP E — Social compose round-trip ===');
// create
const c = await fetch(`${APP}/api/social`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json', cookie },
  body: JSON.stringify({
    title: 'Agent system audit',
    body: `${MARKER} initial body`,
    channels: ['facebook'],
    media_ids: ['asset:logos/legends_logo'],
    action: 'draft',
  }),
});
const cb = await c.json();
console.log(`  CREATE -> HTTP ${c.status} ok=${cb.ok} id=${cb.post?.id} media_saved=${cb.post?.metadata?.media_ids?.length}`);
socialId = cb.post?.id;

// reopen
const r = await fetch(`${APP}/social/${socialId}`, { headers: { cookie } });
const html = await r.text();
console.log(`  REOPEN -> HTTP ${r.status} body_marker=${html.includes(MARKER)} media_token=${html.includes('asset:logos/legends_logo')}`);

// patch
const p = await fetch(`${APP}/api/social`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json', cookie },
  body: JSON.stringify({
    post_id: socialId,
    title: 'Agent system audit (edited)',
    body: `${MARKER} edited body`,
    channels: ['facebook'],
    media_ids: ['asset:logos/legends_logo'],
    action: 'draft',
  }),
});
const pb = await p.json();
console.log(`  PATCH  -> HTTP ${p.status} ok=${pb.ok} same_id=${pb.post?.id === socialId}`);

console.log('\n=== STEP F — Email draft + request_test ===');
const e = await fetch(`${APP}/api/email`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json', cookie },
  body: JSON.stringify({
    subject: 'Agent system audit email',
    preview_text: 'Verification only',
    body_text: `${MARKER} verification body`,
    body_html: `<p>${MARKER} verification body</p>`,
    recipient_list: 'audience:00000000-0000-0000-0000-000000000000',
    audience_id: null,
    action: 'request_test',
  }),
});
const eb = await e.json();
console.log(`  TEST   -> HTTP ${e.status} ok=${eb.ok} test_recipient=${eb.test_recipient} job_status=${eb.job?.status} status=${eb.campaign?.status}`);
campaignId = eb.campaign?.id;

console.log('\n=== CLEANUP ===');
let cleaned = 0;
if (socialId) {
  const { error } = await admin.from('social_posts').delete().eq('id', socialId);
  if (!error) { console.log(`  removed social_posts ${socialId}`); cleaned++; }
}
if (campaignId) {
  // first remove any automation_job created for it
  await admin.from('automation_jobs').delete().eq('target_id', campaignId);
  const { error } = await admin.from('email_campaigns').delete().eq('id', campaignId);
  if (!error) { console.log(`  removed email_campaigns ${campaignId}`); cleaned++; }
}
console.log(`  removed ${cleaned} test rows`);

// Verdict
const okE = cb.ok && html.includes(MARKER) && pb.ok && pb.post.id === socialId;
const okF = eb.ok && eb.test_recipient === OWNER && eb.job?.status === 'queued' && eb.campaign?.status === 'draft';
console.log(`\n=== VERDICT: E=${okE ? 'PASS' : 'FAIL'} F=${okF ? 'PASS' : 'FAIL'} ===`);
if (!okE || !okF) process.exit(3);

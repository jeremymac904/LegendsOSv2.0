// Atlas chat smoke test: authenticate as Jeremy via admin generateLink and
// post a real chat message through the dev server. Used to prove the
// /api/ai/chat path end-to-end without a browser session.
import { createClient } from '@supabase/supabase-js';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const OWNER = process.env.NEXT_PUBLIC_OWNER_EMAIL || 'jeremy@mcdonald-mtg.com';
const APP = process.env.APP_URL || 'http://localhost:3000';
const PATH = process.env.SMOKE_PATH || '/api/ai/chat';
const BODY = process.env.SMOKE_BODY || '{"message":"Say only the word OK."}';
const METHOD = process.env.SMOKE_METHOD || 'POST';

if (!SUPA_URL || !SERVICE || !ANON) {
  console.error('missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  process.exit(2);
}

const admin = createClient(SUPA_URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });

const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: OWNER });
if (error) { console.error('generateLink failed', error); process.exit(3); }
const { properties } = data;
const tokenHash = properties.hashed_token;
const verifyOtpType = properties.verification_type;
console.log('generated magiclink hash for', OWNER, 'type=', verifyOtpType);

const user = createClient(SUPA_URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: sess, error: vErr } = await user.auth.verifyOtp({ token_hash: tokenHash, type: verifyOtpType });
if (vErr) { console.error('verifyOtp failed', vErr); process.exit(4); }
const session = sess.session;
if (!session) { console.error('no session returned'); process.exit(5); }
console.log('session acquired; user_id=', session.user.id);

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

const t0 = Date.now();
const init = {
  method: METHOD,
  headers: {
    'content-type': 'application/json',
    accept: 'application/json',
    cookie: `${cookieName}=${cookieValue}`,
  },
};
if (METHOD !== 'GET' && METHOD !== 'HEAD') init.body = BODY;
const res = await fetch(`${APP}${PATH}`, init);
const ms = Date.now() - t0;
const ct = res.headers.get('content-type') ?? '';
console.log(`${METHOD} ${PATH} -> HTTP ${res.status} content-type=${ct} (${ms}ms)`);
const text = await res.text();
console.log(text.slice(0, 1500));

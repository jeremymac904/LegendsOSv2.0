import { createClient } from '@supabase/supabase-js';
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SECRET_KEY;
const OWNER = process.env.NEXT_PUBLIC_OWNER_EMAIL || 'jeremy@mcdonald-mtg.com';
const admin = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } });
const { data, error } = await admin.auth.admin.generateLink({
  type: 'magiclink',
  email: OWNER,
  options: { redirectTo: process.env.REDIRECT_TO || 'https://legndsosv20.netlify.app/auth/callback' },
});
if (error) { console.error(error); process.exit(1); }
console.log(data.properties.action_link);

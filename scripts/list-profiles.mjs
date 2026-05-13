import { createClient } from '@supabase/supabase-js';
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SECRET_KEY;
const admin = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } });
const { data, error } = await admin.from('profiles').select('id,email,role,is_active,created_at').order('created_at', { ascending: true });
if (error) { console.error(error); process.exit(1); }
console.log(`profiles count: ${data.length}`);
data.forEach((p) => console.log(`  ${p.email} role=${p.role} active=${p.is_active}`));

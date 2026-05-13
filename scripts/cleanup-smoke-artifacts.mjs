// Cleanup script for residue created by earlier scripts/*-smoke.mjs runs.
//
// Targets:
//   - chat_threads (+ chat_messages cascade) whose title matches the
//     hardcoded smoke prompts ("Say only the word OK." / "Reply with 'PONG'." / etc.)
//   - social_posts whose body contains the "Smoke test of social composer"
//     marker
//   - shared_resources whose title starts with "Atlas smoke" (any stray
//     test assets)
//   - knowledge_collections + knowledge_items tagged with the Atlas
//     smoke marker prefix ("Smoke Collection ")
//   - any profiles whose email ends in @axonforge-test.invalid plus their
//     auth.users rows
//
// Run with:
//   set -a; source .env.local; set +a
//   node scripts/cleanup-smoke-artifacts.mjs            # dry run
//   CONFIRM=yes node scripts/cleanup-smoke-artifacts.mjs # actually delete
//
// Owner-only artifacts. Real (non-smoke) drafts and threads are untouched.
import { createClient } from '@supabase/supabase-js';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SECRET_KEY;
if (!SUPA_URL || !SERVICE) {
  console.error('missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY');
  process.exit(2);
}
const CONFIRM = process.env.CONFIRM === 'yes';
const admin = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } });

const SMOKE_THREAD_TITLES = [
  'Say only the word OK.',
  "Reply with exactly 'PONG'.",
  "Reply with 'PONG'.",
  'Reply with Hello',
  'Tell me about the axonfor',
];
const SMOKE_SOCIAL_BODY_MARK = 'Smoke test of social composer';
const SMOKE_ASSET_TITLE_PREFIX = 'Atlas smoke';
const SMOKE_COLLECTION_PREFIX = 'Smoke Collection ';
const SMOKE_EMAIL_DOMAIN = '@axonforge-test.invalid';

function preview(label, rows) {
  console.log(`${label}: ${rows.length}`);
  for (const r of rows.slice(0, 10)) {
    console.log('  ·', r.id, r.title ?? r.email ?? r.body?.slice(0, 60) ?? '');
  }
  if (rows.length > 10) console.log(`  · …and ${rows.length - 10} more`);
}

// 1) chat_threads to delete (by title match — exact strings).
const { data: threadsByTitle } = await admin
  .from('chat_threads')
  .select('id,title')
  .in('title', SMOKE_THREAD_TITLES);
// also fuzzy: any thread with title that contains "axonforge9821"
const { data: threadsByContent } = await admin
  .from('chat_threads')
  .select('id,title')
  .ilike('title', '%axonforge9821%');
const threads = [
  ...(threadsByTitle ?? []),
  ...(threadsByContent ?? []).filter(
    (t) => !(threadsByTitle ?? []).some((x) => x.id === t.id)
  ),
];
preview('chat_threads', threads);

// 2) social_posts smoke drafts.
const { data: socialPosts } = await admin
  .from('social_posts')
  .select('id,body')
  .ilike('body', `%${SMOKE_SOCIAL_BODY_MARK}%`);
preview('social_posts', socialPosts ?? []);

// 3) shared_resources stray assets.
const { data: assetRows } = await admin
  .from('shared_resources')
  .select('id,title')
  .ilike('title', `${SMOKE_ASSET_TITLE_PREFIX}%`);
preview('shared_resources (smoke)', assetRows ?? []);

// 4) knowledge_collections.
const { data: colls } = await admin
  .from('knowledge_collections')
  .select('id,name')
  .ilike('name', `${SMOKE_COLLECTION_PREFIX}%`);
preview('knowledge_collections', (colls ?? []).map((c) => ({ id: c.id, title: c.name })));

// 5) test profiles + auth.users.
const { data: profiles } = await admin
  .from('profiles')
  .select('id,email')
  .ilike('email', `%${SMOKE_EMAIL_DOMAIN}`);
preview('profiles (test)', profiles ?? []);

if (!CONFIRM) {
  console.log('\nDRY RUN. Re-run with CONFIRM=yes to delete.');
  process.exit(0);
}

console.log('\nDeleting...');

// chat_messages cascade via FK — but be explicit so we get counts.
for (const t of threads) {
  await admin.from('chat_messages').delete().eq('thread_id', t.id);
  await admin.from('chat_threads').delete().eq('id', t.id);
}
console.log(`  chat: removed ${threads.length} threads (messages cascaded)`);

for (const p of socialPosts ?? []) {
  await admin.from('social_posts').delete().eq('id', p.id);
}
console.log(`  social: removed ${(socialPosts ?? []).length} posts`);

for (const a of assetRows ?? []) {
  await admin.from('shared_resources').delete().eq('id', a.id);
}
console.log(`  assets: removed ${(assetRows ?? []).length} shared_resources rows`);

for (const c of colls ?? []) {
  await admin.from('knowledge_items').delete().eq('collection_id', c.id);
  await admin.from('knowledge_collections').delete().eq('id', c.id);
}
console.log(`  knowledge: removed ${(colls ?? []).length} smoke collections`);

for (const p of profiles ?? []) {
  await admin.from('profiles').delete().eq('id', p.id);
  try {
    await admin.auth.admin.deleteUser(p.id);
  } catch (e) {
    console.warn('    auth.admin.deleteUser failed for', p.email, e?.message);
  }
}
console.log(`  profiles: removed ${(profiles ?? []).length} test profiles`);
console.log('done');

// Knowledge retrieval smoke test.
//
// 1. Create a collection + item via service-role (mimics what the UI's
//    Supabase RPC would write — same table writes).
// 2. Bind it to an assistant via assistant_knowledge_access.
// 3. Hit /api/ai/chat with that assistant_id and a keyword that should match.
// 4. Confirm response.knowledge.count >= 1.
// 5. Clean up.
import { createClient } from '@supabase/supabase-js';

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SECRET_KEY;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const OWNER = process.env.NEXT_PUBLIC_OWNER_EMAIL || 'jeremy@mcdonald-mtg.com';
const APP = process.env.APP_URL || 'http://localhost:3000';

const admin = createClient(SUPA_URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });

// Find Jeremy.
const { data: profileRow } = await admin
  .from('profiles')
  .select('id,organization_id')
  .eq('email', OWNER)
  .single();
if (!profileRow) { console.error('owner profile not found'); process.exit(2); }
const userId = profileRow.id;
const orgId = profileRow.organization_id;
console.log('owner profile', { userId, orgId });

const TAG = `axon-smoke-${Date.now()}`;

// Create a private collection.
const { data: col, error: cErr } = await admin
  .from('knowledge_collections')
  .insert({
    user_id: userId,
    organization_id: orgId,
    name: `Smoke Collection ${TAG}`,
    visibility: 'private',
  })
  .select('id')
  .single();
if (cErr) { console.error('collection insert', cErr); process.exit(3); }
const collectionId = col.id;
console.log('collection', collectionId);

// Add a knowledge item with a distinctive keyword.
const { data: item, error: iErr } = await admin
  .from('knowledge_items')
  .insert({
    collection_id: collectionId,
    user_id: userId,
    organization_id: orgId,
    title: 'Axonforge smoke marker',
    content: `${TAG} The unique identifier axonforge9821 is the test marker. The legends mortgage marketing handbook is at legends-marketing-handbook page 4.`,
    source_type: 'note',
  })
  .select('id')
  .single();
if (iErr) { console.error('item insert', iErr); process.exit(4); }
console.log('item', item.id);

// Find or create an assistant.
const { data: existingAsst } = await admin
  .from('atlas_assistants')
  .select('id,name')
  .eq('owner_user_id', userId)
  .limit(1)
  .maybeSingle();
let assistantId = existingAsst?.id ?? null;
if (!assistantId) {
  const { data: created, error: aErr } = await admin
    .from('atlas_assistants')
    .insert({
      organization_id: orgId,
      owner_user_id: userId,
      name: 'Smoke Atlas Profile',
      slug: `smoke-${Date.now()}`,
      visibility: 'owner_only',
      system_prompt: 'Helpful test assistant.',
      default_model: null,
    })
    .select('id')
    .single();
  if (aErr) { console.error('assistant insert', aErr); process.exit(5); }
  assistantId = created.id;
}
console.log('assistant', assistantId, existingAsst?.name);

// Bind the collection to this assistant.
const { error: bindErr } = await admin
  .from('assistant_knowledge_access')
  .insert({ assistant_id: assistantId, collection_id: collectionId });
if (bindErr && !/duplicate key/.test(bindErr.message)) {
  console.error('bind', bindErr); process.exit(6);
}

// Auth as owner via magic link to call the chat API.
const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email: OWNER });
const userClient = createClient(SUPA_URL, ANON, { auth: { persistSession: false } });
const { data: sess } = await userClient.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: link.properties.verification_type });
const session = sess.session;
const projectRef = new URL(SUPA_URL).host.split('.')[0];
const cookie = `sb-${projectRef}-auth-token=${encodeURIComponent(JSON.stringify({
  access_token: session.access_token, refresh_token: session.refresh_token,
  expires_at: session.expires_at, expires_in: session.expires_in,
  token_type: session.token_type, user: session.user,
}))}`;

const r = await fetch(`${APP}/api/ai/chat`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json', cookie },
  body: JSON.stringify({
    assistant_id: assistantId,
    message: 'Tell me about the axonforge9821 identifier. Quote whatever source you have.',
    provider: 'deepseek',
  }),
});
const body = await r.json();
console.log('chat -> HTTP', r.status, 'knowledge_count=', body?.knowledge?.count, 'titles=', body?.knowledge?.sources?.map((s) => s.title));
console.log('assistant reply head:', String(body.content ?? '').slice(0, 240));

// Cleanup.
await admin.from('assistant_knowledge_access').delete().eq('assistant_id', assistantId).eq('collection_id', collectionId);
await admin.from('knowledge_items').delete().eq('id', item.id);
await admin.from('knowledge_collections').delete().eq('id', collectionId);
console.log('cleanup done');

if (!body.ok || !(body.knowledge?.count >= 1)) {
  console.error('FAIL: expected knowledge.count >= 1');
  process.exit(7);
}
console.log('PASS');

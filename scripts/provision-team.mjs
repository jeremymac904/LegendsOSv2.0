#!/usr/bin/env node
// LegendsOS v2 — Team account provisioning (owner-controlled, NO emails).
// ---------------------------------------------------------------------------
// Mirrors the /api/admin/users "add" path as a batch CLI, driven by the
// verified roster (lib/team/roster.ts). For each member it:
//   1. createUser({ email_confirm: true })  -> NO confirmation email is sent.
//      The bootstrap trigger inserts a profiles row.
//   2. upsert the profiles row with the correct role + full_name + org + active.
//   3. generateLink({ type: 'recovery' })   -> a setup link the member uses to
//      set a password (lands on /auth/set-password). generateLink NEVER emails.
// It NEVER calls inviteUserByEmail (which would email). It NEVER prints secrets
// or the service key. Setup links are written to a gitignored local file only.
//
// Jeremy (owner) already has accounts and is intentionally NOT created here —
// we only ensure his owner profile has full_name set so AI-twin binding matches.
//
// Run:  node scripts/provision-team.mjs --dry-run   (plan only, no writes)
//       node scripts/provision-team.mjs             (creates accounts)
// ---------------------------------------------------------------------------

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DRY = process.argv.includes("--dry-run");

function loadEnv() {
  // Worktree has no .env.local; the main checkout (3 levels up) does.
  const candidates = [join(ROOT, ".env.local"), join(ROOT, "../../../.env.local")];
  for (const f of candidates) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    break;
  }
}
loadEnv();

const URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SECRET_KEY in .env.local. Aborting.");
  process.exit(1);
}
const db = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const ORG_ID = "3e8536a3-e21c-4c5b-9f2a-d0ef0bc37aea"; // The Legends Mortgage Team
const SET_PASSWORD_REDIRECT = "https://legndsosv20.netlify.app/auth/set-password";

// Verified roster (mirror of lib/team/roster.ts). Jeremy handled separately.
const ROSTER = [
  { name: "Ashley Rogers", email: "ashley@lfprocessing.net", role: "processor" },
  { name: "Geraldine DaVila", email: "geraldine.davila@loanfactory.com", role: "coordinator" },
  { name: "Barbara Jordan", email: "barbaraj@loanfactory.com", role: "loan_officer" },
  { name: "Bryan Payne", email: "bryan.payne@loanfactory.com", role: "loan_officer" },
  { name: "Christina Bús", email: "christina.bus@loanfactory.com", role: "loan_officer" },
  { name: "Eric Jason Ritchie", email: "eric.ritchie@loanfactory.com", role: "loan_officer" },
  { name: "Hugo Calvillo", email: "hugo.calvillo@loanfactory.com", role: "loan_officer" },
  { name: "Jesus Urquiza", email: "jesus.urquiza@loanfactory.com", role: "loan_officer" },
  { name: "Mark Sileck", email: "mark.sileck@loanfactory.com", role: "loan_officer" },
  { name: "Raleigh Morrison", email: "raleigh.morrison@loanfactory.com", role: "loan_officer" },
  { name: "Alison McLeod", email: "alison.mcleod@loanfactory.com", role: "loan_officer" },
  { name: "Scott Mason", email: "scott.mason@loanfactory.com", role: "loan_officer" },
  { name: "Irene Holden", email: "irene.holden@loanfactory.com", role: "loan_officer" },
];

const JEREMY_OWNER_EMAIL = "jeremy@mcdonald-mtg.com";

// Build an email -> auth user map (paginated).
async function loadAuthUsers() {
  const map = new Map();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data?.users ?? [];
    for (const u of users) if (u.email) map.set(u.email.toLowerCase(), u);
    if (users.length < 200) break;
  }
  return map;
}

async function main() {
  console.log(`\n=== Team provisioning ${DRY ? "(DRY RUN — no writes)" : "(LIVE)"} — NO emails sent ===\n`);
  const existing = DRY ? new Map() : await loadAuthUsers();
  const results = [];
  const links = {};

  // Ensure Jeremy's owner profile carries full_name (for AI-twin owner_atlas binding).
  if (!DRY) {
    const owner = existing.get(JEREMY_OWNER_EMAIL);
    if (owner) {
      await db.from("profiles").update({ full_name: "Jeremy McDonald", organization_id: ORG_ID }).eq("id", owner.id);
      console.log("· owner profile (jeremy@mcdonald-mtg.com): ensured full_name='Jeremy McDonald'");
    }
  }

  for (const m of ROSTER) {
    const emailLc = m.email.toLowerCase();
    let action = "";
    let userId = null;
    let linkGenerated = false;

    if (DRY) {
      results.push({ email: m.email, role: m.role, action: "would_create_or_update", link: false });
      continue;
    }

    const found = existing.get(emailLc);
    try {
      if (found) {
        userId = found.id;
        action = "exists_updated";
      } else {
        const { data, error } = await db.auth.admin.createUser({
          email: m.email,
          email_confirm: true, // confirmed, NO confirmation email sent
          user_metadata: { full_name: m.name },
        });
        if (error) throw error;
        userId = data.user.id;
        action = "created";
      }

      // Upsert the profile with the correct role/name/org. Never downgrade an owner.
      const { data: prof } = await db.from("profiles").select("id,role").eq("id", userId).maybeSingle();
      const currentRole = prof?.role ?? null;
      const role = currentRole === "owner" ? "owner" : m.role;
      const { error: upErr } = await db.from("profiles").upsert(
        {
          id: userId,
          email: m.email,
          full_name: m.name,
          role,
          organization_id: ORG_ID,
          is_active: true,
        },
        { onConflict: "id" }
      );
      if (upErr) throw upErr;

      // Generate a setup link for newly-created accounts (no email sent).
      if (action === "created") {
        const { data: link, error: linkErr } = await db.auth.admin.generateLink({
          type: "recovery",
          email: m.email,
          options: { redirectTo: SET_PASSWORD_REDIRECT },
        });
        if (!linkErr && link?.properties?.action_link) {
          links[m.email] = link.properties.action_link;
          linkGenerated = true;
        }
      }
      results.push({ email: m.email, role, action, link: linkGenerated });
      console.log(`✓ ${m.email.padEnd(38)} role=${role.padEnd(12)} ${action}${linkGenerated ? " +setup_link" : ""}`);
    } catch (e) {
      results.push({ email: m.email, role: m.role, action: "ERROR", error: e.message, link: false });
      console.log(`✗ ${m.email.padEnd(38)} ERROR: ${e.message}`);
    }
  }

  if (!DRY && Object.keys(links).length) {
    const out = join(__dirname, ".provision-links.local.json");
    writeFileSync(out, JSON.stringify(links, null, 2));
    console.log(`\nSetup links (sensitive) written to scripts/.provision-links.local.json (gitignored). NOT printed here.`);
  }

  console.log("\n--- summary ---");
  const created = results.filter((r) => r.action === "created").length;
  const updated = results.filter((r) => r.action === "exists_updated").length;
  const errors = results.filter((r) => r.action === "ERROR").length;
  console.log(JSON.stringify({ total: results.length, created, updated, errors, links: Object.keys(links).length }, null, 2));
  console.log(DRY ? "\nDRY RUN — nothing written." : "\nProvisioning complete. No emails were sent.");
}

main().catch((e) => {
  console.error("Provisioning failed:", e.message);
  process.exit(1);
});

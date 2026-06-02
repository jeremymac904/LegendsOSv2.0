#!/usr/bin/env node
// LegendsOS v2 — AI Twin ingestion: persona/memory-seed/skill markdown -> agent runtime tables.
// ---------------------------------------------------------------------------
// Reads personas/, memory-seeds/, skills/, team-shared-skills/ and writes:
//   - agent_memories  (persona/voice/rules/content/seed) for users WITH a profile
//   - agent_skills    (initial skills) for users WITH a profile
//   - agent_skills     (team-shared, owner-owned) for role personas (FLO/Coordinator)
//                      and the 12 shared skill clusters
// Idempotent: ingested rows are tagged (source_summary / metadata.source =
// 'ai_twin_ingest') and replaced on re-run. Uses the service role (RLS bypass)
// so it can seed any user + shared skills. NEVER prints secret values.
//
// Run:  node scripts/ingest-ai-twins.mjs            (writes)
//       node scripts/ingest-ai-twins.mjs --dry-run  (prints plan only)
// ---------------------------------------------------------------------------

import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DRY = process.argv.includes("--dry-run");

// ---- env (load .env.local without printing secrets) -----------------------
function loadEnv() {
  const f = join(ROOT, ".env.local");
  if (existsSync(f)) {
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}
loadEnv();

const URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!DRY && (!URL || !KEY)) {
  console.error("Missing SUPABASE_URL / SUPABASE_SECRET_KEY in env (.env.local). Aborting.");
  process.exit(1);
}
const db = DRY ? null : createClient(URL, KEY, { auth: { persistSession: false } });

// ---- persona -> agent_type + role mapping ---------------------------------
// Personas are keyed by file slug; map each to its primary agent + a name.
const ROLE_AGENT = {
  "ashley-rogers": { agent: "processor_flo", roleShared: true },
  "geraldine-davila": { agent: "coordinator_agent", roleShared: true },
  "jeremy-mcdonald": { agent: "owner_atlas", roleShared: false },
  // every other persona is a loan officer -> lo_atlas
};
const agentFor = (slug) => ROLE_AGENT[slug]?.agent ?? "lo_atlas";

// Explicit account -> persona overrides (accounts whose display name doesn't
// match a persona). The test LO demonstrates "Atlas loads an LO's persona".
const EMAIL_PERSONA = {
  "jeremy.mcdonald@loanfactory.com": "jeremy-mcdonald",
};

// ---- tiny markdown section parser -----------------------------------------
function parse(md) {
  const sections = {};
  let cur = null,
    sub = null;
  for (const raw of md.split("\n")) {
    const h2 = raw.match(/^##\s+(.+)/);
    const h3 = raw.match(/^###\s+(.+)/);
    const li = raw.match(/^\s*-\s+(.+)/);
    if (h2) {
      cur = h2[1].trim();
      sections[cur] = { _bullets: [], _subs: {} };
      sub = null;
    } else if (h3 && cur) {
      sub = h3[1].trim();
      sections[cur]._subs[sub] = [];
    } else if (li && cur) {
      (sub ? sections[cur]._subs[sub] : sections[cur]._bullets).push(li[1].trim());
    }
  }
  return sections;
}
const bullets = (s, name) => s[name]?._bullets ?? [];
const sub = (s, name, subName) => s[name]?._subs?.[subName] ?? [];
const title1 = (md) => (md.match(/^#\s+(.+)/m)?.[1] ?? "").replace(/\s+AI Twin$/, "").trim();
const slugify = (n) =>
  n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "skill";

// ---- build memory rows from a persona -------------------------------------
function memoryRows(slug, persona) {
  const rows = [];
  const push = (category, title, lines, priority = "high") => {
    const body = (lines || []).filter(Boolean).join(" ").slice(0, 4000);
    if (body) rows.push({ category, title, body, priority });
  };
  push("profile_preference", "Persona", bullets(persona, "Personality Profile"));
  push("tone_preference", "Voice — words to use", sub(persona, "Voice Profile", "Used"));
  push("tone_preference", "Voice — words to avoid", sub(persona, "Voice Profile", "Avoid"));
  push("personal_rule", "How to answer as me", sub(persona, "Atlas Twin Rules", "How Atlas should answer as them"));
  push("personal_rule", "How NOT to answer as me", sub(persona, "Atlas Twin Rules", "How Atlas should not answer as them"));
  push("social_workflow", "Content I should create", sub(persona, "Content Profile", "Should Create"), "medium");
  push("assistant_note", "Memory seed", bullets(persona, "Memory Seed"));
  // Processor / FLO extras
  push("loan_condition_workflow", "Condition management style", sub(persona, "FLO Rules", "Condition management style"));
  push("document_workflow", "Processing style", sub(persona, "FLO Rules", "Processing style"));
  return rows;
}

function skillNames(persona) {
  return bullets(persona, "Skill Recommendations").slice(0, 8);
}

// ---- main -----------------------------------------------------------------
async function run() {
  const personaDir = join(ROOT, "personas");
  const sharedDir = join(ROOT, "team-shared-skills");
  const files = readdirSync(personaDir).filter((f) => f.endsWith(".md"));

  // profiles + owner
  let profiles = [];
  if (!DRY) {
    const { data, error } = await db.from("profiles").select("id,email,full_name,role");
    if (error) throw error;
    profiles = data || [];
  }
  const owner = profiles.find((p) => p.role === "owner") || profiles[0] || { id: "dry-run", organization_id: null };
  // Diacritic-insensitive name match so "Christina Bús" (profile) matches the
  // persona title "Christina Bus" and vice-versa.
  const norm = (s) =>
    (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const byName = (name) => profiles.find((p) => norm(p.full_name) === norm(name));

  const plan = { memories: 0, userSkills: 0, roleSkills: 0, sharedSkills: 0, pending: [] };

  // ---- personas -> memory + skills ----
  for (const file of files) {
    const slug = file.replace(/\.md$/, "");
    const md = readFileSync(join(personaDir, file), "utf8");
    const persona = parse(md);
    const name = title1(md) || slug;
    const agent = agentFor(slug);

    // Resolve target (profile, agentType) pairs: name match (+ owner also seeds
    // lo_atlas), plus any account explicitly mapped to this persona by email.
    const targets = [];
    const named = byName(name);
    if (named) {
      targets.push({ profile: named, agent });
      if (named.role === "owner" && agent !== "lo_atlas") targets.push({ profile: named, agent: "lo_atlas" });
    }
    for (const p of profiles) {
      if (EMAIL_PERSONA[p.email] === slug && !targets.some((t) => t.profile.id === p.id && t.agent === "lo_atlas")) {
        targets.push({ profile: p, agent: "lo_atlas" });
      }
    }

    if (targets.length) {
      for (const { profile, agent: at } of targets) {
        const mems = memoryRows(slug, persona).map((r) => ({
          user_id: profile.id,
          organization_id: profile.organization_id ?? null,
          agent_type: at,
          category: r.category,
          title: r.title,
          body: r.body,
          confidence: "high",
          priority: r.priority,
          source_summary: "ai_twin_ingest",
          is_active: true,
        }));
        const skills = skillNames(persona).map((sn) => ({
          user_id: profile.id,
          organization_id: profile.organization_id ?? null,
          agent_type: at,
          skill_name: sn,
          skill_slug: slugify(sn),
          description: `${name} twin skill — ${sn}.`,
          created_by: profile.id,
          is_active: true,
          metadata: { source: "ai_twin_ingest", persona: slug },
        }));
        plan.memories += mems.length;
        plan.userSkills += skills.length;
        if (!DRY) {
          await db.from("agent_memories").delete().eq("source_summary", "ai_twin_ingest").eq("user_id", profile.id).eq("agent_type", at);
          if (mems.length) await db.from("agent_memories").insert(mems);
          for (const s of skills) await db.from("agent_skills").upsert(s, { onConflict: "user_id,agent_type,skill_slug" });
        }
        console.log(`✓ ${name} -> ${at} (${mems.length} memories, ${skills.length} skills) [account: ${profile.email}]`);
      }
    } else if (ROLE_AGENT[slug]?.roleShared) {
      // Role persona (Ashley/Geraldine) -> team-shared skills owned by owner,
      // so FLO/Coordinator load them for ANY user acting in that role.
      const rules = [
        ...sub(persona, "Atlas Twin Rules", "How Atlas should answer as them"),
        ...sub(persona, "FLO Rules", "Processing style"),
        ...sub(persona, "FLO Rules", "Condition management style"),
        ...bullets(persona, "Memory Seed"),
      ];
      const voice = sub(persona, "Voice Profile", "Used");
      const roleSkill = {
        user_id: owner.id,
        organization_id: owner.organization_id ?? null,
        agent_type: agent,
        skill_name: `${name} — role persona`,
        skill_slug: slugify(`${slug}-role-persona`),
        description: `${name} (${(persona["Role"] ? "" : "")}role twin). Voice: ${voice.slice(0, 6).join(", ")}.`,
        steps: rules.slice(0, 12),
        output_format: "Lead with status, blocker, next action, and owner. Calm, precise, file-first.",
        created_by: owner.id,
        visibility: "team_shared",
        is_active: true,
        is_shared_with_team: true,
        metadata: { source: "ai_twin_ingest", persona: slug, role_persona: true },
      };
      plan.roleSkills += 1;
      const skills = skillNames(persona).map((sn) => ({
        user_id: owner.id,
        organization_id: owner.organization_id ?? null,
        agent_type: agent,
        skill_name: sn,
        skill_slug: slugify(sn),
        description: `${name} processing skill — ${sn}.`,
        created_by: owner.id,
        visibility: "team_shared",
        is_active: true,
        is_shared_with_team: true,
        metadata: { source: "ai_twin_ingest", persona: slug },
      }));
      plan.roleSkills += skills.length;
      if (!DRY) {
        for (const s of [roleSkill, ...skills]) await db.from("agent_skills").upsert(s, { onConflict: "user_id,agent_type,skill_slug" });
      }
      console.log(`✓ ${name} -> ${agent} TEAM-SHARED role persona + ${skills.length} skills (owned by owner)`);
    } else {
      plan.pending.push(`${name} (${agent})`);
      console.log(`· ${name} -> ${agent}: PENDING account (no profile yet; re-run after their account is created)`);
    }
  }

  // ---- team-shared skill clusters ----
  if (existsSync(sharedDir)) {
    for (const file of readdirSync(sharedDir).filter((f) => f.endsWith(".md"))) {
      const md = readFileSync(join(sharedDir, file), "utf8");
      const s = parse(md);
      const name = title1(md);
      const slug = (md.match(/^Slug:\s*(.+)/m)?.[1] || slugify(name)).trim();
      const purpose = (md.match(/^Purpose:\s*(.+)/m)?.[1] || "").trim();
      const row = {
        user_id: owner.id,
        organization_id: owner.organization_id ?? null,
        agent_type: "lo_atlas",
        skill_name: name,
        skill_slug: slug,
        description: purpose,
        steps: bullets(s, "Core Prompt"),
        output_format: bullets(s, "Guardrails").join(" "),
        created_by: owner.id,
        visibility: "team_shared",
        is_active: true,
        is_shared_with_team: true,
        metadata: { source: "ai_twin_ingest", shared_cluster: true },
      };
      plan.sharedSkills += 1;
      if (!DRY) await db.from("agent_skills").upsert(row, { onConflict: "user_id,agent_type,skill_slug" });
      console.log(`✓ shared skill: ${name}`);
    }
  }

  console.log("\n--- summary ---");
  console.log(JSON.stringify(plan, null, 2));
  console.log(DRY ? "DRY RUN — nothing written." : "Ingestion complete.");
}

run().catch((e) => {
  console.error("Ingestion failed:", e.message);
  process.exit(1);
});

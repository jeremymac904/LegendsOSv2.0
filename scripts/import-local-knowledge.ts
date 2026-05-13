#!/usr/bin/env node
/**
 * LegendsOS — import local knowledge sources
 *
 * Scans selected folders under `future/`, parses safe text files, and
 * upserts into:
 *   public.knowledge_collections
 *   public.knowledge_items
 *   public.assistant_knowledge_access  (collection → assistant wiring)
 *
 * Idempotent. Re-runs:
 *   - lookup collections by (owner_user_id, name)
 *   - lookup items by (collection_id, metadata->>source_path)
 *   - skip / update by content hash; insert when new
 *
 * Safety:
 *   - Only .md / .txt / .csv / .json files; everything else is skipped.
 *   - Per-file size cap of 256 KB. Anything larger is recorded as a
 *     pointer item (content = "<source too large — N bytes>").
 *   - Excluded directory names: node_modules, .git, .next, dist, build,
 *     __MACOSX, __pycache__.
 *   - Files whose name suggests credentials (.env, *.pem, *.key) are
 *     skipped.
 *
 * Usage:
 *   npm run import-local-knowledge          # do the work
 *   DRY=1 npm run import-local-knowledge    # plan only, no writes
 */

import { createClient } from "@supabase/supabase-js";
import { config as dotenvConfig } from "dotenv";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

dotenvConfig({ path: ".env.local" });

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://eifkdkifkstkubzpzgpb.supabase.co";
const SECRET =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const DRY = ["1", "true", "yes"].includes((process.env.DRY ?? "").toLowerCase());

if (!SECRET) {
  console.error("Missing SUPABASE_SECRET_KEY in .env.local");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SECRET, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const REPO_ROOT = resolve(process.cwd());
const FUTURE = join(REPO_ROOT, "future");

// ---------------------------------------------------------------------------
// Source plan
// ---------------------------------------------------------------------------
// knowledge_visibility is a Postgres enum with only ('private', 'team_shared').
// In our RLS model, `private` for an owner-created row is functionally
// owner-only — the row is visible to its creator (always Jeremy here) plus
// any owner-role member via is_owner(), and invisible to loan officers.
// We keep the human-friendly `owner_only` label internally and translate
// at write time.
type Visibility = "owner_only" | "team_shared";
function dbVisibility(v: Visibility): "private" | "team_shared" {
  return v === "team_shared" ? "team_shared" : "private";
}

interface Source {
  // Display name for the knowledge_collections row.
  collection_name: string;
  // Short description shown in the UI.
  description: string;
  // Absolute path on disk to scan.
  root: string;
  // Subpaths to EXCLUDE (relative to root). Useful for splitting one kit
  // folder into multiple collections (see Marketing & Recruiting below).
  exclude_subpaths?: string[];
  // Default visibility for the resulting collection.
  visibility: Visibility;
  // If true, even empty (no safe text files) we still create the collection.
  always_create?: boolean;
  // Assistant names this collection should be wired to (by name).
  assistant_names?: string[];
}

const SOURCES: Source[] = [
  {
    collection_name: "Loan Factory AI Assistants",
    description:
      "System prompts, behavior rules, deployment instructions and knowledge documents for the Loan Factory assistants — excluding the Marketing & Recruiting kit.",
    root: join(FUTURE, "Loan_Factory_AI_Assistants"),
    exclude_subpaths: ["Loan_Factory_Marketing_Recruiting_Assistant_UPLOAD_READY"],
    visibility: "team_shared",
    assistant_names: [
      "Loan Factory AI Mortgage Coach",
      "Loan Factory Credit AI Assistant",
      "Loan Factory Elite LO Assistant",
      "Loan Factory Real Estate Investor Assistant",
    ],
  },
  {
    collection_name: "Loan Factory Marketing & Recruiting",
    description:
      "Owner-only kit covering marketing scaffolds, recruiter playbooks, brand voice, and compliance review checklists.",
    root: join(
      FUTURE,
      "Loan_Factory_AI_Assistants",
      "Loan_Factory_Marketing_Recruiting_Assistant_UPLOAD_READY"
    ),
    visibility: "owner_only",
    assistant_names: ["Loan Factory Marketing & Recruiting Assistant"],
  },
  {
    collection_name: "Loan Factory Training",
    description:
      "Loan Factory training material — process, products, and SOP knowledge.",
    root: join(FUTURE, "LoanFactory Training"),
    visibility: "team_shared",
    assistant_names: [
      "Loan Factory AI Mortgage Coach",
      "Loan Factory Credit AI Assistant",
      "Loan Factory Elite LO Assistant",
    ],
  },
  {
    collection_name: "Loan Factory Social Media Assistant",
    description:
      "Social-media content generation knowledge — voice, channels, prompt library.",
    root: join(FUTURE, "LoanFactory_Social_Media_Assistant_ELITE_v1"),
    visibility: "team_shared",
    // Wired below to the Social/Content assistant.
  },
  {
    collection_name: "Legends Realtor Coach Knowledge",
    description: "Realtor coach knowledge base — daily execution, content engine.",
    root: join(FUTURE, "legends_realtor_coach_knowledge"),
    visibility: "team_shared",
    assistant_names: ["Loan Factory Realtor Coach"],
  },
  {
    collection_name: "28 Day Social Templates",
    description:
      "28-day social media template library (Legends). PNG templates only — no indexed text, but the collection is created so the picker can reference it later.",
    root: join(FUTURE, "28 Days Social Media Templates Legends"),
    visibility: "owner_only",
    always_create: true,
  },
  {
    collection_name: "40 Day Jeremy Social Templates",
    description: "40-day social media templates for Jeremy. PNG templates only.",
    root: join(FUTURE, "40 Days Social Media Templates for Jeremy"),
    visibility: "owner_only",
    always_create: true,
  },
  {
    collection_name: "Jeremy YouTube Video Inventory",
    description:
      "Inventory of Jeremy's Mortgage Mentor YouTube videos for content repurposing.",
    root: join(
      FUTURE,
      "# YouTube Video Inventory — Jeremy McDonald, The Mortgage Mentor.md"
    ),
    visibility: "owner_only",
  },
];

// Additional assistant-mappings expressed after sources are known.
const SOCIAL_ASSISTANT_NAME = "Loan Factory Social Media Assistant"; // placeholder
const SOCIAL_COLLECTIONS_FOR_CONTENT_ASSISTANT = [
  "Loan Factory Social Media Assistant",
  "28 Day Social Templates",
  "40 Day Jeremy Social Templates",
  "Jeremy YouTube Video Inventory",
];
// If no "Social/Content" assistant exists in atlas_assistants yet, we'll just
// skip the social wiring rather than fail.

// ---------------------------------------------------------------------------
// File walker
// ---------------------------------------------------------------------------
const ALLOWED_EXT = new Set([".md", ".txt", ".csv", ".json"]);
const EXCLUDE_DIRS = new Set([
  "node_modules", ".git", ".next", "dist", "build",
  "__MACOSX", "__pycache__", ".venv", "venv",
]);
const SUSPICIOUS_NAMES = new Set([".env", ".envrc"]);
const MAX_BYTES = 256 * 1024;

function isSuspicious(name: string): boolean {
  if (SUSPICIOUS_NAMES.has(name)) return true;
  if (/\.(env|pem|key|p12|pfx)(\..+)?$/i.test(name)) return true;
  if (/\.env\..+/.test(name)) return true;
  return false;
}

function fileExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

interface ScannedFile {
  abs: string;
  relativeToRepo: string;
  relativeToRoot: string;
  name: string;
  ext: string;
  size: number;
}

function walk(root: string, exclude: string[] = []): ScannedFile[] {
  const out: ScannedFile[] = [];
  if (!existsSync(root)) return out;
  const stat = statSync(root);
  // Treat a single-file root specially.
  if (stat.isFile()) {
    return [
      {
        abs: root,
        relativeToRepo: relative(REPO_ROOT, root),
        relativeToRoot: stat.isFile() ? root.split("/").slice(-1)[0] : "",
        name: root.split("/").slice(-1)[0],
        ext: fileExt(root),
        size: stat.size,
      },
    ];
  }
  const excludeSet = new Set(exclude.map((s) => s.replace(/\/+$/, "")));
  function recurse(dir: string) {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.startsWith(".") && entry !== ".env") continue;
      if (EXCLUDE_DIRS.has(entry)) continue;
      const abs = join(dir, entry);
      let st;
      try {
        st = statSync(abs);
      } catch {
        continue;
      }
      const relRoot = relative(root, abs);
      if (excludeSet.has(relRoot.split("/")[0]) || excludeSet.has(relRoot)) continue;
      if (st.isDirectory()) {
        recurse(abs);
      } else if (st.isFile()) {
        out.push({
          abs,
          relativeToRepo: relative(REPO_ROOT, abs),
          relativeToRoot: relRoot,
          name: entry,
          ext: fileExt(entry),
          size: st.size,
        });
      }
    }
  }
  recurse(root);
  return out;
}

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------
async function getOrgId(): Promise<string> {
  const { data, error } = await sb
    .from("organizations")
    .select("id")
    .eq("slug", "legends-mortgage")
    .maybeSingle();
  if (error || !data) throw new Error("organization 'legends-mortgage' not found");
  return data.id;
}

async function getOwnerId(): Promise<string> {
  const { data, error } = await sb
    .from("profiles")
    .select("id")
    .eq("role", "owner")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) throw new Error("no owner profile found");
  return data.id;
}

interface CollectionRow {
  id: string;
  name: string;
  visibility: Visibility;
}

async function upsertCollection(
  organization_id: string,
  owner_user_id: string,
  src: Source
): Promise<CollectionRow> {
  const { data: existing } = await sb
    .from("knowledge_collections")
    .select("id,name,visibility")
    .eq("organization_id", organization_id)
    .eq("name", src.collection_name)
    .maybeSingle();
  if (existing) {
    if (!DRY) {
      await sb
        .from("knowledge_collections")
        .update({
          description: src.description,
          visibility: dbVisibility(src.visibility),
          metadata: {
            source_root: src.root,
            seeded_by: "scripts/import-local-knowledge.ts",
          },
        })
        .eq("id", existing.id);
    }
    return existing as CollectionRow;
  }
  if (DRY) {
    return { id: "<dry-run>", name: src.collection_name, visibility: src.visibility };
  }
  const { data, error } = await sb
    .from("knowledge_collections")
    .insert({
      organization_id,
      user_id: owner_user_id,
      name: src.collection_name,
      description: src.description,
      visibility: dbVisibility(src.visibility),
      metadata: {
        source_root: src.root,
        seeded_by: "scripts/import-local-knowledge.ts",
      },
    })
    .select("id,name,visibility")
    .single();
  if (error || !data) throw error ?? new Error("collection insert failed");
  return data as CollectionRow;
}

interface ItemRowLite {
  id: string;
  metadata: Record<string, unknown> | null;
  content: string | null;
}

async function listExistingItems(
  collection_id: string
): Promise<Map<string, ItemRowLite>> {
  const map = new Map<string, ItemRowLite>();
  const PAGE = 500;
  let from = 0;
  while (true) {
    const { data, error } = await sb
      .from("knowledge_items")
      .select("id,metadata,content")
      .eq("collection_id", collection_id)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const row of data) {
      const sp = (row.metadata as { source_path?: string } | null)?.source_path;
      if (sp) map.set(sp, row);
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return map;
}

function readContent(f: ScannedFile): { content: string; truncated: boolean } {
  if (f.size > MAX_BYTES) {
    return {
      content: `<source larger than ${MAX_BYTES} bytes — see ${f.relativeToRepo}>`,
      truncated: true,
    };
  }
  try {
    const buf = readFileSync(f.abs);
    return { content: buf.toString("utf-8"), truncated: false };
  } catch (e) {
    return { content: `<read failed: ${(e as Error).message}>`, truncated: true };
  }
}

function contentHash(text: string): string {
  return createHash("sha1").update(text).digest("hex");
}

interface UpsertStats {
  inserted: number;
  updated: number;
  unchanged: number;
  skipped_ext: number;
  skipped_size: number;
  skipped_suspicious: number;
}

async function importCollection(
  organization_id: string,
  owner_user_id: string,
  collection: CollectionRow,
  src: Source
): Promise<UpsertStats> {
  const stats: UpsertStats = {
    inserted: 0,
    updated: 0,
    unchanged: 0,
    skipped_ext: 0,
    skipped_size: 0,
    skipped_suspicious: 0,
  };
  if (!existsSync(src.root)) return stats;
  const files = walk(src.root, src.exclude_subpaths ?? []);
  const existing = DRY ? new Map<string, ItemRowLite>() : await listExistingItems(collection.id);

  for (const f of files) {
    if (isSuspicious(f.name)) {
      stats.skipped_suspicious++;
      continue;
    }
    if (!ALLOWED_EXT.has(f.ext)) {
      stats.skipped_ext++;
      continue;
    }
    const { content, truncated } = readContent(f);
    if (truncated && f.size > MAX_BYTES) stats.skipped_size++;
    const sp = f.relativeToRepo;
    const ehash = contentHash(content);
    const baseMeta = {
      source_path: sp,
      file_name: f.name,
      relative_path: f.relativeToRoot,
      bytes: f.size,
      content_hash: ehash,
      truncated,
      imported_at: new Date().toISOString(),
    };

    const prior = existing.get(sp);
    if (prior) {
      const priorHash =
        (prior.metadata as { content_hash?: string } | null)?.content_hash ?? "";
      if (priorHash === ehash) {
        stats.unchanged++;
        continue;
      }
      if (!DRY) {
        await sb
          .from("knowledge_items")
          .update({
            content,
            title: f.name,
            source_type: "file",
            source_uri: null,
            metadata: { ...(prior.metadata as object), ...baseMeta },
          })
          .eq("id", prior.id);
      }
      stats.updated++;
      continue;
    }

    if (!DRY) {
      const { error } = await sb.from("knowledge_items").insert({
        collection_id: collection.id,
        user_id: owner_user_id,
        organization_id,
        title: f.name,
        content,
        source_type: "file",
        source_uri: null,
        metadata: baseMeta,
      });
      if (error) {
        console.error(`  insert failed ${sp}: ${error.message}`);
        continue;
      }
    }
    stats.inserted++;
  }
  return stats;
}

async function ensureAssistantAccess(
  assistant_name: string,
  collection_id: string,
  granted_by: string
) {
  const { data: a } = await sb
    .from("atlas_assistants")
    .select("id")
    .eq("name", assistant_name)
    .maybeSingle();
  if (!a) return false;
  if (DRY) return true;
  // Upsert: the table has composite PK (assistant_id, collection_id) so we
  // can rely on on-conflict-do-nothing semantics via insert.
  const { error } = await sb.from("assistant_knowledge_access").insert({
    assistant_id: a.id,
    collection_id,
    granted_by,
  });
  if (error && !/duplicate/i.test(error.message)) {
    console.error(`  mapping error: ${error.message}`);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
async function main() {
  const organization_id = await getOrgId();
  const owner_user_id = await getOwnerId();
  console.log(`mode=${DRY ? "DRY" : "WRITE"}  org=${organization_id}  owner=${owner_user_id}`);

  const created: { src: Source; collection: CollectionRow; stats: UpsertStats }[] = [];
  for (const src of SOURCES) {
    const exists = existsSync(src.root);
    if (!exists && !src.always_create) {
      console.log(`SKIP ${src.collection_name}: source missing (${src.root})`);
      continue;
    }
    const collection = await upsertCollection(organization_id, owner_user_id, src);
    const stats = exists
      ? await importCollection(organization_id, owner_user_id, collection, src)
      : ({ inserted: 0, updated: 0, unchanged: 0, skipped_ext: 0, skipped_size: 0, skipped_suspicious: 0 } as UpsertStats);
    created.push({ src, collection, stats });
    console.log(
      `OK   ${src.collection_name.padEnd(40)} ` +
        `vis=${src.visibility}  ` +
        `+${stats.inserted}/=${stats.unchanged}/~${stats.updated}` +
        `  skip(ext=${stats.skipped_ext},size=${stats.skipped_size},sus=${stats.skipped_suspicious})`
    );
  }

  // Assistant mappings
  console.log("--- assistant ↔ collection wiring ---");
  for (const { src, collection } of created) {
    for (const aname of src.assistant_names ?? []) {
      const ok = await ensureAssistantAccess(aname, collection.id, owner_user_id);
      console.log(`  ${ok ? "OK" : "MISS"} ${aname}  →  ${src.collection_name}`);
    }
  }

  // Social/Content assistant wiring: the social assistant's display name in
  // atlas_assistants is "Loan Factory Social Media / Content Assistant" per
  // the seed script, but the kit folder is called LoanFactory_..._ELITE_v1.
  // The seeded assistant name we have is "Loan Factory Social Media …".
  const socialAssistants = ["Loan Factory Social Media Assistant", "Loan Factory Social Media / Content Assistant"];
  for (const collectionName of SOCIAL_COLLECTIONS_FOR_CONTENT_ASSISTANT) {
    const c = created.find((x) => x.src.collection_name === collectionName);
    if (!c) continue;
    let mapped = false;
    for (const aname of socialAssistants) {
      const ok = await ensureAssistantAccess(aname, c.collection.id, owner_user_id);
      if (ok) {
        console.log(`  OK ${aname}  →  ${collectionName}`);
        mapped = true;
        break;
      }
    }
    if (!mapped)
      console.log(`  MISS (no Social/Content assistant present)  →  ${collectionName}`);
  }

  // Summary footer
  console.log("--- totals ---");
  const totals = created.reduce(
    (acc, { stats }) => {
      acc.inserted += stats.inserted;
      acc.updated += stats.updated;
      acc.unchanged += stats.unchanged;
      acc.skipped_ext += stats.skipped_ext;
      acc.skipped_size += stats.skipped_size;
      acc.skipped_suspicious += stats.skipped_suspicious;
      return acc;
    },
    { inserted: 0, updated: 0, unchanged: 0, skipped_ext: 0, skipped_size: 0, skipped_suspicious: 0 }
  );
  console.log(JSON.stringify(totals, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// Silence unused-export warning on placeholder constant
void SOCIAL_ASSISTANT_NAME;

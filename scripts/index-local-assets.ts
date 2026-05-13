#!/usr/bin/env node
/**
 * LegendsOS — local asset scanner
 *
 * Scans:
 *   images/   → classifies into logos / backgrounds / team / misc
 *   future/   → catalogs subfolders for the knowledge-source manifest
 *
 * Output:
 *   public/assets/manifest.json    (asset library — committed, served at /assets/*)
 *   public/assets/logos/*.png
 *   public/assets/backgrounds/*.jpg
 *   public/assets/team/*.png       (resized via macOS `sips` to 512px wide)
 *   docs/LOCAL_KNOWLEDGE_SOURCE_MANIFEST.md
 *
 * Idempotent — re-runs are safe; the script only writes when content differs.
 * Heavy/raw images that don't match a category stay in images/ untouched.
 *
 * Usage (via tsx from package.json):
 *   npm run index-assets
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync, statSync, readdirSync } from "node:fs";
import { dirname, join, basename, resolve } from "node:path";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const REPO_ROOT = resolve(process.cwd());
const IMAGES_DIR = join(REPO_ROOT, "images");
const FUTURE_DIR = join(REPO_ROOT, "future");
const PUBLIC_ASSETS = join(REPO_ROOT, "public", "assets");
const LOGOS_DIR = join(PUBLIC_ASSETS, "logos");
const BG_DIR = join(PUBLIC_ASSETS, "backgrounds");
const TEAM_DIR = join(PUBLIC_ASSETS, "team");
const MANIFEST = join(PUBLIC_ASSETS, "manifest.json");
const KNOWLEDGE_MANIFEST_DOC = join(REPO_ROOT, "docs", "LOCAL_KNOWLEDGE_SOURCE_MANIFEST.md");

[PUBLIC_ASSETS, LOGOS_DIR, BG_DIR, TEAM_DIR, dirname(KNOWLEDGE_MANIFEST_DOC)].forEach(
  (p) => {
    if (!existsSync(p)) mkdirSync(p, { recursive: true });
  }
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type AssetCategory =
  | "logo"
  | "background"
  | "team_photo"
  | "social_image"
  | "image_studio_reference"
  | "unclassified";

export interface AssetRecord {
  id: string; // stable string id derived from public path
  category: AssetCategory;
  label: string; // pretty display name
  file_name: string; // basename of the original
  public_path: string | null; // e.g. "/assets/logos/legends-os-logo.png" — null if not copied
  source_path: string; // absolute path on Jeremy's machine (for re-running the scanner)
  size_bytes: number;
  width?: number;
  height?: number;
  tags: string[];
  default_visibility: "owner_only" | "team_shared";
  person?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------
const LOGO_MAP: Record<string, string> = {
  "legends-os-logo.png": "legends-os-logo.png",
  "lf-processing-logo.png": "lf-processing-logo.png",
  "airealtorprodark-logo.png": "airealtorprodark-logo.png",
  "airealtorprolight-logo.png": "airealtorprolight-logo.png",
};

const BACKGROUND_MAP: Record<string, { dest: string; mode: "dark" | "light"; label: string }> = {
  "Elegant abstract command center environment with subtle depth, sleek glass architecture panels with soft transparency, minimal digital grids barely visible, luxury fintech atmosphere, very subtle city skyline silhouette in far background, m.jpg":
    { dest: "command-center-elegant.jpg", mode: "light", label: "Command Center — Elegant Light" },
  "Futuristic command center atmosphere with elegant digital operations environment, abstract financial intelligence visualization, subtle city skyline silhouette in deep background, sleek glass panels with reflections, soft glowing data grids.jpg":
    { dest: "command-center-futuristic.jpg", mode: "dark", label: "Command Center — Futuristic Dark" },
};

// Person name → output filename. Lower-case key for matching against the
// filename's leading word (case-insensitive prefix).
const TEAM_MAP: { match: RegExp; person: string; dest: string }[] = [
  { match: /^alison/i, person: "Alison", dest: "alison.png" },
  { match: /^ashley/i, person: "Ashley", dest: "ashley.png" },
  { match: /^barbra/i, person: "Barbara", dest: "barbara.png" },
  { match: /^bryan/i, person: "Bryan", dest: "bryan.png" },
  { match: /^christina/i, person: "Christina", dest: "christina.png" },
  { match: /^eric/i, person: "Eric", dest: "eric.png" },
  { match: /^hugo/i, person: "Hugo", dest: "hugo.png" },
  { match: /^irene/i, person: "Irene", dest: "irene.png" },
  { match: /^jeremy/i, person: "Jeremy McDonald", dest: "jeremy.png" },
  { match: /^jesus/i, person: "Jesus", dest: "jesus.png" },
  { match: /^mark/i, person: "Mark", dest: "mark.png" },
  { match: /^raleigh/i, person: "Raleigh", dest: "raleigh.png" },
  { match: /^scott/i, person: "Scott", dest: "scott.png" },
  // Optional: alex appears in "Closing Day Alex.png" — treat as social_image
];

function classify(fileName: string): {
  category: AssetCategory;
  destFileName?: string;
  destSubdir?: string;
  label: string;
  person?: string;
  tags: string[];
  notes?: string;
} {
  if (LOGO_MAP[fileName]) {
    return {
      category: "logo",
      destFileName: LOGO_MAP[fileName],
      destSubdir: "logos",
      label: fileName.replace(/\.[a-z]+$/i, "").replace(/-/g, " "),
      tags: ["brand"],
    };
  }
  if (BACKGROUND_MAP[fileName]) {
    const meta = BACKGROUND_MAP[fileName];
    return {
      category: "background",
      destFileName: meta.dest,
      destSubdir: "backgrounds",
      label: meta.label,
      tags: ["background", meta.mode],
    };
  }
  for (const m of TEAM_MAP) {
    if (m.match.test(fileName)) {
      return {
        category: "team_photo",
        destFileName: m.dest,
        destSubdir: "team",
        label: m.person,
        person: m.person,
        tags: ["team", "headshot"],
      };
    }
  }
  if (/closing\s*day/i.test(fileName)) {
    return {
      category: "social_image",
      label: fileName.replace(/\.[a-z]+$/i, ""),
      tags: ["social", "closing"],
    };
  }
  if (/^chatgpt image /i.test(fileName)) {
    return {
      category: "image_studio_reference",
      label: "ChatGPT-generated reference",
      tags: ["reference"],
    };
  }
  return {
    category: "unclassified",
    label: fileName.replace(/\.[a-z]+$/i, ""),
    tags: [],
  };
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------
function copyIfChanged(src: string, dest: string) {
  if (existsSync(dest)) {
    const s = statSync(src);
    const d = statSync(dest);
    if (s.size === d.size && s.mtimeMs <= d.mtimeMs) return false;
  }
  copyFileSync(src, dest);
  return true;
}

// Resize via macOS `sips` to keep team headshots small (target 512px wide).
function resizeIfChanged(src: string, dest: string, widthPx = 512): boolean {
  if (existsSync(dest)) {
    const d = statSync(dest);
    const s = statSync(src);
    if (s.mtimeMs <= d.mtimeMs) return false;
  }
  // sips: copy source first, then resize the copy
  copyFileSync(src, dest);
  try {
    execFileSync("sips", ["-Z", String(widthPx), dest], { stdio: "pipe" });
    return true;
  } catch {
    // If sips fails, leave the full-size copy (better than nothing).
    return true;
  }
}

function safeBytes(p: string): number {
  try {
    return statSync(p).size;
  } catch {
    return 0;
  }
}

function publicId(path: string): string {
  return path.replace(/^\/?assets\//, "asset:").replace(/[^a-zA-Z0-9:_/.-]/g, "-");
}

// ---------------------------------------------------------------------------
// Scan images/
// ---------------------------------------------------------------------------
function scanImages(): AssetRecord[] {
  const records: AssetRecord[] = [];
  if (!existsSync(IMAGES_DIR)) return records;
  const entries = readdirSync(IMAGES_DIR);
  for (const name of entries) {
    if (name.startsWith(".")) continue;
    const srcPath = join(IMAGES_DIR, name);
    const stat = statSync(srcPath);
    if (!stat.isFile()) continue;
    const c = classify(name);
    let publicPath: string | null = null;

    if (c.category === "logo" && c.destFileName) {
      const dest = join(LOGOS_DIR, c.destFileName);
      copyIfChanged(srcPath, dest);
      publicPath = `/assets/logos/${c.destFileName}`;
    } else if (c.category === "background" && c.destFileName) {
      const dest = join(BG_DIR, c.destFileName);
      copyIfChanged(srcPath, dest);
      publicPath = `/assets/backgrounds/${c.destFileName}`;
    } else if (c.category === "team_photo" && c.destFileName) {
      const dest = join(TEAM_DIR, c.destFileName);
      resizeIfChanged(srcPath, dest, 512);
      publicPath = `/assets/team/${c.destFileName}`;
    }
    // Other categories stay in images/ and are NOT copied to public/.

    records.push({
      id: publicId(publicPath ?? `local:images/${name}`),
      category: c.category,
      label: c.label,
      file_name: name,
      public_path: publicPath,
      source_path: srcPath,
      size_bytes: publicPath ? safeBytes(join(REPO_ROOT, "public", publicPath)) : stat.size,
      tags: c.tags,
      default_visibility: c.category === "team_photo" ? "team_shared" : "owner_only",
      person: c.person,
      notes: c.notes,
    });
  }
  return records;
}

// ---------------------------------------------------------------------------
// Scan future/ — folder-level catalog only, no file recursion
// ---------------------------------------------------------------------------
interface KnowledgeFolder {
  name: string;
  kind: "folder" | "file";
  path: string;
  purpose: string;
  recommended_use: string;
  atlas_assistant?: string;
  module?: string;
  priority: "now" | "next" | "later" | "ignore" | "owner_only";
  notes?: string;
}

function inferFolder(name: string): KnowledgeFolder {
  const base = name.toLowerCase();
  if (base.includes("super_ralph")) {
    return {
      name,
      kind: "folder",
      path: join("future", name),
      purpose: "Developer reference / Ralph loop tooling",
      recommended_use: "Internal developer reference only.",
      module: "internal",
      priority: "owner_only",
      notes: "Do not expose to normal users.",
    };
  }
  if (base.includes("youtube video inventory")) {
    return {
      name,
      kind: "file",
      path: join("future", name),
      purpose: "YouTube video inventory — The Mortgage Mentor",
      recommended_use: "Content repurposing source for Atlas + Social Studio.",
      atlas_assistant: "Loan Factory Social Media / Content Assistant",
      module: "social",
      priority: "now",
    };
  }
  if (base.includes("heygen")) {
    return {
      name,
      kind: "file",
      path: join("future", name),
      purpose: "HeyGen video agent prompting system",
      recommended_use: "Reference for AI video prompting workflows.",
      module: "atlas",
      priority: "later",
    };
  }
  if (base.includes("28 days social")) {
    return {
      name,
      kind: "folder",
      path: join("future", name),
      purpose: "28-day social media template library (Legends)",
      recommended_use: "Social Studio template seed.",
      module: "social",
      priority: "now",
    };
  }
  if (base.includes("40 days social")) {
    return {
      name,
      kind: "folder",
      path: join("future", name),
      purpose: "40-day social media templates for Jeremy",
      recommended_use: "Personal social template seed.",
      module: "social",
      priority: "now",
    };
  }
  if (base.includes("florida-home-buying-network")) {
    return {
      name,
      kind: "folder",
      path: join("future", name),
      purpose: "Florida Home Buying Network site / marketing",
      recommended_use: "Knowledge about the FHBN brand + destination URLs.",
      module: "knowledge",
      priority: "next",
    };
  }
  if (base.includes("geo-seo")) {
    return {
      name,
      kind: "folder",
      path: join("future", name),
      purpose: "GEO / SEO optimization knowledge",
      recommended_use: "Content/SEO reference for Atlas.",
      module: "knowledge",
      priority: "next",
    };
  }
  if (base.includes("hermes-agent")) {
    return {
      name,
      kind: "folder",
      path: join("future", name),
      purpose: "Hermes-style agent reference",
      recommended_use: "Atlas (Hermes-style) capability reference.",
      module: "atlas",
      priority: "later",
    };
  }
  if (base.includes("humanizer")) {
    return {
      name,
      kind: "folder",
      path: join("future", name),
      purpose: "Content humanization",
      recommended_use: "Reference for humanizing AI-generated copy.",
      module: "atlas",
      priority: "later",
    };
  }
  if (base.includes("legends team lo marketing")) {
    return {
      name,
      kind: "folder",
      path: join("future", name),
      purpose: "Loan officer marketing source material",
      recommended_use: "Knowledge collection (private LO marketing).",
      module: "knowledge",
      priority: "next",
    };
  }
  if (base.includes("legends team pro pic")) {
    return {
      name,
      kind: "folder",
      path: join("future", name),
      purpose: "Team site / pro photo source",
      recommended_use: "Already partially indexed under public/assets/team/.",
      module: "assets",
      priority: "now",
    };
  }
  if (base.includes("legends_realtor_coach_knowledge")) {
    return {
      name,
      kind: "folder",
      path: join("future", name),
      purpose: "Realtor coach knowledge base",
      recommended_use: "Atlas knowledge source.",
      atlas_assistant: "Loan Factory Realtor Coach",
      module: "knowledge",
      priority: "next",
    };
  }
  if (base.includes("legends-brand-design-system")) {
    return {
      name,
      kind: "folder",
      path: join("future", name),
      purpose: "Brand design system",
      recommended_use: "Brand reference for UI + image generation.",
      module: "assets",
      priority: "next",
    };
  }
  if (base.includes("legends-mortgage-marketing-image-gen")) {
    return {
      name,
      kind: "folder",
      path: join("future", name),
      purpose: "Mortgage marketing image generation reference",
      recommended_use: "Image Studio workflow reference.",
      module: "images",
      priority: "later",
    };
  }
  if (base.includes("loan_factory_ai_assistants") || base.includes("loanfactory_ai_assistants")) {
    return {
      name,
      kind: "folder",
      path: join("future", name),
      purpose: "Loan Factory AI assistants",
      recommended_use: "Atlas assistant seed (multiple personas).",
      module: "atlas",
      priority: "now",
    };
  }
  if (base.includes("loanfactory training") || base.includes("training knwoledge") || base.includes("training knowledge")) {
    return {
      name,
      kind: "folder",
      path: join("future", name),
      purpose: "Loan Factory training material",
      recommended_use: "Knowledge collection.",
      module: "knowledge",
      priority: "next",
    };
  }
  if (base.includes("loanfactory_social_media_assistant_elite")) {
    return {
      name,
      kind: "folder",
      path: join("future", name),
      purpose: "LF social-media content generation knowledge",
      recommended_use: "Atlas social assistant seed.",
      atlas_assistant: "Loan Factory Social Media / Content Assistant",
      module: "social",
      priority: "now",
    };
  }
  if (base.includes("legends-team-website")) {
    return {
      name,
      kind: "folder",
      path: join("future", name),
      purpose: "Team website project",
      recommended_use: "Public website (separate deploy).",
      module: "external",
      priority: "later",
    };
  }
  if (base.includes("loan-factory-safe-test-prep")) {
    return {
      name,
      kind: "folder",
      path: join("future", name),
      purpose: "SAFE test prep",
      recommended_use: "Knowledge collection for licensing prep.",
      module: "knowledge",
      priority: "later",
    };
  }
  if (base.includes("claude skills")) {
    return {
      name,
      kind: "folder",
      path: join("future", name),
      purpose: "Claude skills snapshot",
      recommended_use: "Developer-only reference.",
      module: "internal",
      priority: "owner_only",
    };
  }
  if (base.includes("creator-s-ai-twin")) {
    return {
      name,
      kind: "folder",
      path: join("future", name),
      purpose: "Creator AI Twin reference",
      recommended_use: "Atlas personalization reference.",
      module: "atlas",
      priority: "later",
    };
  }
  // Zip files — skip; the extracted folder is what gets cataloged.
  if (base.endsWith(".zip")) {
    return {
      name,
      kind: "file",
      path: join("future", name),
      purpose: "Archive (extracted version present)",
      recommended_use: "Skip — already extracted.",
      priority: "ignore",
    };
  }
  return {
    name,
    kind: "folder",
    path: join("future", name),
    purpose: "Uncategorized",
    recommended_use: "Review and assign a category.",
    priority: "later",
  };
}

function scanFuture(): KnowledgeFolder[] {
  if (!existsSync(FUTURE_DIR)) return [];
  return readdirSync(FUTURE_DIR)
    .filter((n) => !n.startsWith("."))
    .sort((a, b) => a.localeCompare(b))
    .map(inferFolder);
}

// ---------------------------------------------------------------------------
// Manifests
// ---------------------------------------------------------------------------
function writeAssetManifest(assets: AssetRecord[]) {
  const generated_at = new Date().toISOString();
  const summary: Record<string, number> = {};
  for (const a of assets) summary[a.category] = (summary[a.category] ?? 0) + 1;
  const payload = { generated_at, summary, assets };
  const json = JSON.stringify(payload, null, 2) + "\n";
  let prev = "";
  try {
    prev = readFileSync(MANIFEST, "utf-8");
  } catch {}
  if (prev !== json) {
    writeFileSync(MANIFEST, json);
    return true;
  }
  return false;
}

function writeKnowledgeManifest(folders: KnowledgeFolder[]) {
  const now = new Date().toISOString().slice(0, 10);
  const lines = [
    "# Local Knowledge Source Manifest",
    "",
    `_Generated by \`scripts/index-local-assets.ts\` on ${now}._`,
    "",
    "This is an inventory of `future/` — folders Jeremy has staged on his",
    "machine that can be imported into LegendsOS as knowledge collections,",
    "assistant seed material, or studio templates. **No files are committed",
    "to the repo from `future/`** — this manifest is the bridge between",
    "what's on disk and what the app can import on demand.",
    "",
    "| Priority | Folder | Purpose | Recommended LegendsOS use | Module / assistant |",
    "| --- | --- | --- | --- | --- |",
  ];
  const order = { now: 0, next: 1, later: 2, owner_only: 3, ignore: 4 } as const;
  const sorted = [...folders].sort(
    (a, b) => order[a.priority] - order[b.priority] || a.name.localeCompare(b.name)
  );
  for (const f of sorted) {
    const tag = f.atlas_assistant ? f.atlas_assistant : f.module ?? "";
    const escaped = (s: string) => s.replace(/\|/g, "\\|");
    lines.push(
      `| ${f.priority} | \`${f.name}\` | ${escaped(f.purpose)} | ${escaped(f.recommended_use)} | ${escaped(tag)} |`
    );
  }
  lines.push(
    "",
    "## Priority key",
    "",
    "- **now** — high-value source material; import in the next pass.",
    "- **next** — bring in once the file-parser + URL ingester ship.",
    "- **later** — interesting reference; not blocking.",
    "- **owner_only** — internal/dev material; do not surface to loan officers.",
    "- **ignore** — duplicates (zip vs extracted), drafts, scratch.",
    "",
    "## Importing",
    "",
    "Each row maps to a folder under `future/`. The Knowledge Sources page",
    "(`/knowledge`) already supports manual file drop; a future pass will add",
    "a one-click import button that creates a `knowledge_collections` row + a",
    "`knowledge_items` row per top-level file in the folder.",
    ""
  );
  const body = lines.join("\n");
  let prev = "";
  try {
    prev = readFileSync(KNOWLEDGE_MANIFEST_DOC, "utf-8");
  } catch {}
  if (prev !== body) {
    writeFileSync(KNOWLEDGE_MANIFEST_DOC, body);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
const assets = scanImages();
const folders = scanFuture();
const assetManifestChanged = writeAssetManifest(assets);
const knowledgeManifestChanged = writeKnowledgeManifest(folders);

// Pretty summary
const byCategory: Record<string, number> = {};
for (const a of assets) byCategory[a.category] = (byCategory[a.category] ?? 0) + 1;
console.log("--- asset summary ---");
for (const k of Object.keys(byCategory).sort()) {
  console.log(`  ${k.padEnd(28)} ${byCategory[k]}`);
}
console.log(
  `  ${"manifest.json".padEnd(28)} ${assetManifestChanged ? "updated" : "unchanged"}`
);
console.log(`  ${"knowledge manifest".padEnd(28)} ${knowledgeManifestChanged ? "updated" : "unchanged"}`);
console.log(`  ${"future folders".padEnd(28)} ${folders.length}`);

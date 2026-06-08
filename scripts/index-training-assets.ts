#!/usr/bin/env node
/**
 * LegendsOS - local training/community asset indexer.
 *
 * Read-only scanner. It does not move, delete, upload, or write to Supabase.
 * It creates a compact JSON index that app surfaces can search today while
 * preserving local source paths and any Drive/source links found in the files.
 *
 * Usage:
 *   npm run index-training-assets
 *   npm run index-training-assets -- --check
 */

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";

type AssetKind =
  | "video"
  | "audio"
  | "document"
  | "transcript"
  | "summary"
  | "script"
  | "prompt"
  | "roleplay"
  | "tracker"
  | "community"
  | "knowledge";

interface SourceGroup {
  id: string;
  label: string;
  root: string;
  includeExt: string[];
  priority: number;
  allowFiles?: string[];
  allowPathPattern?: RegExp;
}

interface ScannedFile {
  absPath: string;
  relativeToRoot: string;
  relativeToRepo: string;
  sourceGroupId: string;
  sourceGroup: string;
  priority: number;
  ext: string;
  sizeBytes: number;
  modifiedAt: string;
}

interface TrainingAsset {
  id: string;
  title: string;
  kind: AssetKind;
  category: string;
  sourceGroup: string;
  format: string;
  localPath: string;
  relativePath: string;
  sizeBytes: number;
  modifiedAt: string;
  summary: string;
  tags: string[];
  sourceUrls: string[];
  driveUrls: string[];
  transcriptPath: string | null;
  summaryPath: string | null;
  ownerReviewRecommended: boolean;
}

const REPO_ROOT = resolve(process.cwd());
const MASTER_ROOT = process.env.LEGENDS_MASTER_ROOT
  ? resolve(process.env.LEGENDS_MASTER_ROOT)
  : resolve(REPO_ROOT, "../../..");
const OUTPUT_PATH = resolve(
  REPO_ROOT,
  "lib/legends/training-assets.generated.json"
);
const CHECK = process.argv.includes("--check");
const MAX_EXCERPT = Number(process.env.TRAINING_ASSET_EXCERPT_CHARS ?? "320");
const MAX_ASSETS = Number(process.env.TRAINING_ASSET_MAX ?? "1200");

const APP_SOURCE_ROOT = join(
  MASTER_ROOT,
  "loan-factory-product-starter-kit/apps/loan-factory-elite-sales-marketing-training"
);

const SOURCE_GROUPS: SourceGroup[] = [
  {
    id: "lf-ai-training-videos",
    label: "Loan Factory AI Training Videos",
    root: join(MASTER_ROOT, "Loan Factory AI Training Videos"),
    includeExt: [".mp4", ".md"],
    priority: 100,
  },
  {
    id: "loans-on-demand",
    label: "Loans On Demand Videos",
    root: join(MASTER_ROOT, "Loans On Demand Videos"),
    includeExt: [".mp4", ".mov", ".pdf", ".docx", ".pptx", ".odp", ".md", ".txt", ".url"],
    priority: 95,
  },
  {
    id: "video-summaries",
    label: "Video Summaries",
    root: join(MASTER_ROOT, "video_summaries"),
    includeExt: [".md"],
    priority: 90,
  },
  {
    id: "document-summaries",
    label: "Document Summaries",
    root: join(MASTER_ROOT, "document_summaries"),
    includeExt: [".md"],
    priority: 89,
  },
  {
    id: "transcripts",
    label: "Transcript Markdown",
    root: join(MASTER_ROOT, "transcripts"),
    includeExt: [".md"],
    priority: 88,
    allowPathPattern: /\.transcript\.md$/i,
  },
  {
    id: "coaching-rebuild",
    label: "Loan Factory Coaching Final Rebuild",
    root: join(MASTER_ROOT, "Loan_Factory_Coaching_Final_Rebuild"),
    includeExt: [".pdf", ".docx", ".pptx"],
    priority: 84,
  },
  {
    id: "vip-coaching",
    label: "VIP Coaching Ecosystem",
    root: join(MASTER_ROOT, "VIP_Coaching_Ecosystem_Working"),
    includeExt: [".md", ".csv", ".pdf", ".docx", ".pptx"],
    priority: 82,
  },
  {
    id: "lf-coaching-docs",
    label: "Loan Factory Coaching Docs",
    root: join(MASTER_ROOT, "loan-factory-coaching/docs"),
    includeExt: [".md", ".csv", ".json", ".pdf"],
    priority: 80,
  },
  {
    id: "lf-coaching-audio",
    label: "Loan Factory Coaching Audio",
    root: join(MASTER_ROOT, "loan-factory-coaching/public/audio"),
    includeExt: [".m4a", ".mp3"],
    priority: 79,
  },
  {
    id: "lf-coaching-downloads",
    label: "Loan Factory Coaching Downloads",
    root: join(MASTER_ROOT, "loan-factory-coaching/public/downloads"),
    includeExt: [".md", ".docx", ".pdf", ".pptx"],
    priority: 78,
  },
  {
    id: "lo-dev-handoff",
    label: "LO Development Handoff",
    root: join(
      MASTER_ROOT,
      "_staging/lo-development-codex-handoff-review/lo-development-codex-handoff"
    ),
    includeExt: [".md", ".csv", ".txt"],
    priority: 76,
  },
  {
    id: "ai-twin-pack",
    label: "LO Development AI Twin Pack",
    root: join(MASTER_ROOT, "_staging/lo-development-ai-twin-system-pack"),
    includeExt: [".md", ".csv", ".txt", ".json"],
    priority: 74,
  },
  {
    id: "ai-training-clips",
    label: "AI Training Clips",
    root: join(MASTER_ROOT, "_staging/ai-training-video-clips"),
    includeExt: [".mp4", ".mov", ".md", ".txt"],
    priority: 72,
  },
  {
    id: "source-app-data",
    label: "LO Development Source App Data",
    root: join(APP_SOURCE_ROOT, "src/data"),
    includeExt: [".ts"],
    priority: 70,
    allowFiles: [
      "modules.ts",
      "scripts.ts",
      "prompts.ts",
      "roleplays.ts",
      "audioTraining.ts",
      "aiTrainingVideos.ts",
      "driveAssets.ts",
      "trackerFields.ts",
      "complianceRules.ts",
      "paths.ts",
      "recommendedChannels.ts",
    ],
  },
  {
    id: "source-app-core-docs",
    label: "LO Development Source App Core Docs",
    root: join(APP_SOURCE_ROOT, "docs"),
    includeExt: [".md", ".csv", ".json", ".pdf"],
    priority: 68,
    allowPathPattern:
      /(CURRICULUM|AI_TRAINING|AUDIO|SOURCE_MAP|MODULE_MAP|DRIVE|ASSET|ROLE|COMMUNITY|FACEGRAM|ASSISTANT|PROMPT|COMPLIANCE|TRACKER|SCRIPT|QUIZ|PERSONA|BETA|PLATFORM|RECORDING)/i,
  },
];

const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "out",
  ".vercel",
  ".netlify",
  "__MACOSX",
  "__pycache__",
  ".venv",
  "venv",
  "_whisperkit_logs",
]);

const TEXT_EXTS = new Set([".md", ".txt", ".csv", ".json", ".ts", ".url"]);

function isSuspiciousPath(pathValue: string): boolean {
  const lower = pathValue.toLowerCase();
  return (
    /(^|[/\\])\.env($|[./\\])/.test(lower) ||
    /(secret|api[_-]?key|token|oauth|credential|private[_-]?key)/.test(lower) ||
    /supabase[/\\]migrations/.test(lower) ||
    /package-lock\.json$/.test(lower) ||
    /tsconfig\.tsbuildinfo$/.test(lower) ||
    /\.ds_store$/.test(lower)
  );
}

function walkGroup(group: SourceGroup): ScannedFile[] {
  const files: ScannedFile[] = [];
  if (!existsSync(group.root)) return files;
  const includeExt = new Set(group.includeExt.map((ext) => ext.toLowerCase()));
  const allowFiles = group.allowFiles ? new Set(group.allowFiles) : null;

  function visit(dir: string) {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (EXCLUDED_DIRS.has(entry)) continue;
      const absPath = join(dir, entry);
      if (isSuspiciousPath(absPath)) continue;
      let stat;
      try {
        stat = statSync(absPath);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        visit(absPath);
        continue;
      }
      if (!stat.isFile()) continue;
      const ext = extname(entry).toLowerCase();
      const relRoot = relative(group.root, absPath);
      if (!includeExt.has(ext)) continue;
      if (allowFiles && !allowFiles.has(entry)) continue;
      if (group.allowPathPattern && !group.allowPathPattern.test(relRoot)) continue;
      files.push({
        absPath,
        relativeToRoot: relRoot,
        relativeToRepo: relative(REPO_ROOT, absPath),
        sourceGroupId: group.id,
        sourceGroup: group.label,
        priority: group.priority,
        ext,
        sizeBytes: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      });
    }
  }

  visit(group.root);
  return files;
}

function readText(filePath: string, maxChars = 40_000): string {
  try {
    return readFileSync(filePath, "utf8").slice(0, maxChars);
  } catch {
    return "";
  }
}

function plainText(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#+\s+/gm, "")
    .replace(/\[[^\]]+\]\(([^)]+)\)/g, "$1")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function excerpt(input: string): string {
  const text = plainText(input).replace(/\s+/g, " ");
  return text.length > MAX_EXCERPT ? `${text.slice(0, MAX_EXCERPT - 3)}...` : text;
}

function titleFromPath(filePath: string): string {
  return basename(filePath)
    .replace(/\.(transcript|summary)\.md$/i, "")
    .replace(/\.(mp4|mov|m4a|mp3|pdf|docx|pptx|odp|md|txt|csv|json|ts|url)$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function keyFor(value: string): string {
  return basename(value)
    .toLowerCase()
    .replace(/\.(transcript|summary)\.md$/g, "")
    .replace(/\.(mp4|mov|m4a|mp3|pdf|docx|pptx|odp|md|txt|csv|json|ts|url)$/g, "")
    .replace(/[_\-\s]+/g, "")
    .replace(/\b(mp4|mov|m4a|pdf|docx|pptx|md|txt|csv|json|summary|transcript)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function urlsFrom(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s)"'<>]+/g) ?? [];
  return [...new Set(matches.map((url) => url.replace(/[),.;]+$/, "")))].slice(0, 6);
}

function kindFor(file: ScannedFile): AssetKind {
  const pathValue = `${file.sourceGroupId}/${file.relativeToRoot}`.toLowerCase();
  if (file.sourceGroupId.includes("summary")) return "summary";
  if (file.sourceGroupId.includes("transcript") || /\.(srt|vtt)$/i.test(file.ext)) return "transcript";
  if ([".mp4", ".mov"].includes(file.ext)) return "video";
  if ([".m4a", ".mp3"].includes(file.ext)) return "audio";
  if ([".pdf", ".docx", ".pptx", ".odp"].includes(file.ext)) return "document";
  if (/roleplay/.test(pathValue)) return "roleplay";
  if (/script/.test(pathValue)) return "script";
  if (/prompt/.test(pathValue)) return "prompt";
  if (/tracker|scorecard|csv_template/.test(pathValue)) return "tracker";
  if (/community|skool|facegram|creator-network|mastermind|events|groups/.test(pathValue)) {
    return "community";
  }
  return "knowledge";
}

function categoryFor(file: ScannedFile, kind: AssetKind): string {
  const text = `${file.sourceGroup} ${file.relativeToRoot}`.toLowerCase();
  if (kind === "audio") return "Audio Training";
  if (kind === "transcript") return "Transcripts";
  if (/ai|gemini|chatgpt|claude|notebooklm|heygen|prompt|vibe/.test(text)) return "AI Training";
  if (/community|skool|facegram|creator-network|mastermind|events|groups/.test(text)) return "Community";
  if (/script|roleplay|call|borrower|realtor|partner/.test(text)) return "Scripts & Roleplay";
  if (/coach|coaching|mastery|alliance|tracker|scorecard|qbr|ramp/.test(text)) return "Coaching";
  if (/compliance|risk|review|respa|reg z|nmls/.test(text)) return "Compliance";
  if (/101|201|301|401|501|601|curriculum|academy|training path|module/.test(text)) {
    return "Academy Curriculum";
  }
  if (/marketing|social|content|youtube|facebook|ads|seo/.test(text)) return "Marketing Training";
  return "Knowledge";
}

function tagsFor(file: ScannedFile, kind: AssetKind, category: string): string[] {
  const raw = `${file.sourceGroup} ${file.relativeToRoot}`.toLowerCase();
  const tags = new Set<string>([
    kind,
    category,
    file.ext.replace(".", "").toUpperCase(),
  ]);
  for (const [needle, tag] of [
    ["gemini", "Gemini"],
    ["notebook", "NotebookLM"],
    ["heygen", "HeyGen"],
    ["realtor", "Realtor"],
    ["borrower", "Borrower"],
    ["facebook", "Facebook Ads"],
    ["youtube", "YouTube"],
    ["compliance", "Compliance"],
    ["community", "Community"],
    ["script", "Scripts"],
    ["prompt", "Prompts"],
    ["roleplay", "Roleplay"],
    ["tracker", "Trackers"],
  ] as const) {
    if (raw.includes(needle)) tags.add(tag);
  }
  return [...tags].slice(0, 8);
}

function stableId(file: ScannedFile): string {
  return createHash("sha1").update(file.absPath).digest("hex").slice(0, 12);
}

function buildLookup(files: ScannedFile[], groupId: string): Map<string, ScannedFile> {
  const map = new Map<string, ScannedFile>();
  for (const file of files) {
    if (file.sourceGroupId !== groupId) continue;
    map.set(keyFor(file.relativeToRoot), file);
  }
  return map;
}

function buildIndex() {
  const allFiles = SOURCE_GROUPS.flatMap(walkGroup);
  const videoSummaryByKey = buildLookup(allFiles, "video-summaries");
  const documentSummaryByKey = buildLookup(allFiles, "document-summaries");
  const transcriptByKey = buildLookup(allFiles, "transcripts");

  const assets = allFiles.map((file): TrainingAsset => {
    const kind = kindFor(file);
    const category = categoryFor(file, kind);
    const text = TEXT_EXTS.has(file.ext) ? readText(file.absPath) : "";
    const key = keyFor(file.relativeToRoot);
    const summaryFile =
      videoSummaryByKey.get(key) ??
      documentSummaryByKey.get(key) ??
      (kind === "summary" ? file : undefined);
    const transcriptFile = transcriptByKey.get(key) ?? (kind === "transcript" ? file : undefined);
    const summaryText = summaryFile ? readText(summaryFile.absPath) : "";
    const urlText = file.ext === ".url" ? readText(file.absPath) : "";
    const sourceUrls = urlsFrom(`${text}\n${summaryText}\n${urlText}`);
    const driveUrls = sourceUrls.filter((url) => url.includes("drive.google.com"));

    return {
      id: stableId(file),
      title: titleFromPath(file.relativeToRoot),
      kind,
      category,
      sourceGroup: file.sourceGroup,
      format: file.ext.replace(".", "").toUpperCase(),
      localPath: file.absPath,
      relativePath: file.relativeToRoot,
      sizeBytes: file.sizeBytes,
      modifiedAt: file.modifiedAt,
      summary: excerpt(summaryText || text),
      tags: tagsFor(file, kind, category),
      sourceUrls,
      driveUrls,
      transcriptPath: transcriptFile ? transcriptFile.absPath : null,
      summaryPath: summaryFile ? summaryFile.absPath : null,
      ownerReviewRecommended:
        /owner|admin|compliance|risk|paid|review|strategy|support|credential/i.test(
          `${file.sourceGroup} ${file.relativeToRoot}`
        ),
    };
  });

  const byKey = new Map<string, TrainingAsset>();
  for (const asset of assets) {
    const dedupeKey = `${asset.kind}:${keyFor(asset.title)}:${asset.sizeBytes}`;
    const prior = byKey.get(dedupeKey);
    if (!prior || asset.summary.length > prior.summary.length) {
      byKey.set(dedupeKey, asset);
    }
  }

  const deduped = [...byKey.values()]
    .sort((a, b) => {
      const sourceA = SOURCE_GROUPS.find((group) => group.label === a.sourceGroup)?.priority ?? 0;
      const sourceB = SOURCE_GROUPS.find((group) => group.label === b.sourceGroup)?.priority ?? 0;
      if (sourceA !== sourceB) return sourceB - sourceA;
      return a.title.localeCompare(b.title);
    })
    .slice(0, MAX_ASSETS);

  const counts = {
    scannedFiles: allFiles.length,
    indexedAssets: deduped.length,
    truncatedByLimit: Math.max(0, [...byKey.values()].length - deduped.length),
    byKind: countBy(deduped, (asset) => asset.kind),
    byCategory: countBy(deduped, (asset) => asset.category),
    bySourceGroup: countBy(deduped, (asset) => asset.sourceGroup),
  };

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    masterRoot: MASTER_ROOT,
    outputPath: OUTPUT_PATH,
    maxAssets: MAX_ASSETS,
    counts,
    driveLinks: [
      {
        title: "Loan Factory Training Folder",
        url: "https://drive.google.com/drive/folders/164oRV4Vn1XRh6UTySL52USyXDugfQp6a?usp=sharing",
        source: "lib/teamResources.ts",
      },
      {
        title: "Training Knowledge",
        url: "https://drive.google.com/drive/folders/1OKRvYZN6zNP7oBLv6uKDt8c-Hka8HOUg",
        source: "lib/teamResources.ts",
      },
      {
        title: "Loan Factory Training Site",
        url: "https://drive.google.com/drive/folders/1xC82SiXdXA9piA8KIdyGQAVQyuNGtdHU",
        source: "lib/teamResources.ts",
      },
      {
        title: "Training Nugget System",
        url: "https://drive.google.com/drive/folders/1Mls39pZJUwWaUjOI9Ibdmk3BANUl11a6",
        source: "lib/teamResources.ts",
      },
      {
        title: "AI Training Roadmap",
        url: "https://drive.google.com/file/d/1NTslE43SAQEqbhRGjkm9KkHY8IXq1OnW/view?usp=drivesdk",
        source: "lib/teamResources.ts",
      },
      {
        title: "LO Development Docs",
        url: "https://drive.google.com/drive/folders/1ruMCllR7FGVAUn9S38F3_sgafH8heCia",
        source: "lib/teamResources.ts",
      },
      {
        title: "LF AI Training Live Slide Deck Site",
        url: "https://drive.google.com/drive/folders/1NZh2w3KP-Xwzm_pxNxxBPpAo8DwB2LyC",
        source: "lib/teamResources.ts",
      },
    ],
    assets: deduped,
  };
}

function countBy<T>(items: T[], getter: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = getter(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

const index = buildIndex();
const serialized = `${JSON.stringify(index, null, 2)}\n`;

function checkComparable(serializedIndex: string): string {
  try {
    const parsed = JSON.parse(serializedIndex) as { generatedAt?: string };
    parsed.generatedAt = "<ignored-for-check>";
    return `${JSON.stringify(parsed, null, 2)}\n`;
  } catch {
    return serializedIndex;
  }
}

if (CHECK) {
  const current = existsSync(OUTPUT_PATH) ? readFileSync(OUTPUT_PATH, "utf8") : "";
  if (checkComparable(current) !== checkComparable(serialized)) {
    console.error(`Training asset index is stale. Run: npm run index-training-assets`);
    process.exit(1);
  }
  console.log(
    `Training asset index OK: ${index.counts.indexedAssets} assets (${index.counts.scannedFiles} scanned)`
  );
} else {
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, serialized);
  console.log(
    `Wrote ${relative(REPO_ROOT, OUTPUT_PATH)}: ${index.counts.indexedAssets} assets (${index.counts.scannedFiles} scanned)`
  );
  console.log(`By kind: ${JSON.stringify(index.counts.byKind)}`);
  console.log(`By category: ${JSON.stringify(index.counts.byCategory)}`);
}

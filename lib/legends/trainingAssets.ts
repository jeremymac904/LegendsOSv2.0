import rawTrainingAssetIndex from "@/lib/legends/training-assets.generated.json";

export type LocalTrainingAssetKind =
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

export interface LocalTrainingAsset {
  id: string;
  title: string;
  kind: LocalTrainingAssetKind;
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

export interface TrainingAssetCounts {
  scannedFiles: number;
  indexedAssets: number;
  truncatedByLimit: number;
  byKind: Record<string, number>;
  byCategory: Record<string, number>;
  bySourceGroup: Record<string, number>;
}

export interface TrainingAssetDriveLink {
  title: string;
  url: string;
  source: string;
}

export interface TrainingAssetIndex {
  schemaVersion: number;
  generatedAt: string;
  masterRoot: string;
  outputPath: string;
  maxAssets: number;
  counts: TrainingAssetCounts;
  driveLinks: TrainingAssetDriveLink[];
  assets: LocalTrainingAsset[];
}

// ── Display-time rebranding ────────────────────────────────────────────────
// The generated index mirrors source folder and document names from the
// imported archive, which still carry legacy program branding. Everything we
// surface in the UI is Legends Mortgage Academy, so user-visible text fields
// are rebranded here at the module boundary. Local file paths and ids are
// left untouched — they reference real files on disk.
// Patterns are separator-tolerant ([ _-]) and case-insensitive so ALL-CAPS,
// snake_case, and lowercase folder/file-derived strings are caught too. Order
// matters: most-specific first. Bare corporate "Loan Factory" (the parent
// company) is intentionally NOT rewritten — only legacy coaching-program
// branding is.
const REBRAND_RULES: Array<[RegExp, string]> = [
  [/loan[ _-]*factory[ _-]*paid[ _-]*coaching([ _-]*platform)?/gi, "Legends Mortgage Academy"],
  [/loan[ _-]*factory[ _-]*coaching([ _-]*platform)?/gi, "Legends Mortgage Academy"],
  [/loan[ _-]*factory[ _-]*alliance/gi, "Legends Mortgage Academy"],
  [/lo[ _-]+mastery/gi, "Legends Mortgage Academy"],
  [/apex[ _-]+advisor([ _-]+pro)?/gi, "Legends Mortgage Academy"],
  [/\bapex\b/gi, "Academy"],
  [/\balliance\b/gi, "Academy"],
  // Group coaching model — no one-on-one coaching language in surfaced text.
  [/one[-_ ]on[-_ ]one(s)?/gi, "group"],
  [/\bprivate coaching\b/gi, "group coaching"],
  [/\b1:1s?\b/g, "coach review"],
  [/coaching[ _-]sessions?/gi, "group coaching call"],
  [/Coaching[ _-]Sessions?/g, "Group Coaching Call"],
];

// Internal/dev URLs must never render as member-facing "Source" links.
function isPublicSourceUrl(url: string): boolean {
  return !/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/)/i.test(url);
}

function rebrandText(value: string): string {
  return REBRAND_RULES.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    value
  );
}

function rebrandRecordKeys(record: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(record).map(([key, count]) => [rebrandText(key), count])
  );
}

function rebrandAsset(asset: LocalTrainingAsset): LocalTrainingAsset {
  return {
    ...asset,
    title: rebrandText(asset.title),
    category: rebrandText(asset.category),
    sourceGroup: rebrandText(asset.sourceGroup),
    summary: rebrandText(asset.summary),
    tags: asset.tags.map(rebrandText),
    sourceUrls: asset.sourceUrls.filter(isPublicSourceUrl),
  };
}

function rebrandIndex(index: TrainingAssetIndex): TrainingAssetIndex {
  return {
    ...index,
    counts: {
      ...index.counts,
      byCategory: rebrandRecordKeys(index.counts.byCategory),
      bySourceGroup: rebrandRecordKeys(index.counts.bySourceGroup),
    },
    driveLinks: index.driveLinks.map((link) => ({
      ...link,
      title: rebrandText(link.title),
    })),
    assets: index.assets.map(rebrandAsset),
  };
}

export const trainingAssetIndex = rebrandIndex(
  rawTrainingAssetIndex as TrainingAssetIndex
);
export const trainingAssets = trainingAssetIndex.assets;

const ACADEMY_CATEGORIES = new Set([
  "Academy Curriculum",
  "AI Training",
  "Audio Training",
  "Coaching",
  "Scripts & Roleplay",
  "Transcripts",
]);

export const academyTrainingAssets = trainingAssets.filter(
  (asset) =>
    ACADEMY_CATEGORIES.has(asset.category) ||
    /academy|curriculum|module|101|201|301|401|501|601/i.test(asset.relativePath)
);

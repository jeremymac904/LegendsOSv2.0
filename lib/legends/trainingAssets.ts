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
const REBRAND_RULES: Array<[RegExp, string]> = [
  [/Loan Factory Coaching/g, "Legends Mortgage Academy"],
  [/Loan Factory coaching/g, "Legends Mortgage Academy"],
  [/Loan Factory Alliance/g, "Legends Mortgage Academy"],
  [/LO Mastery/g, "Legends Mortgage Academy"],
  [/\bAlliance\b/g, "Academy"],
  // Group coaching model — no one-on-one coaching language in surfaced text.
  [/\bone-on-one\b/gi, "group"],
  [/\bprivate coaching\b/gi, "group coaching"],
  [/\b1:1\b/g, "coach review"],
  [/\bcoaching session\b/g, "group coaching call"],
  [/\bCoaching Session\b/g, "Group Coaching Call"],
];

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

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

export const trainingAssetIndex = rawTrainingAssetIndex as TrainingAssetIndex;
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

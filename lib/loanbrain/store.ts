// LegendsOS v2 — Loan Brain store (DB-or-sample, read-only Drive)
// -----------------------------------------------------------------------------
// This is the single read path the UI/routes use. It tries the real,
// RLS-scoped Supabase tables first; if the mortgage tables don't exist yet
// (migrations not applied, error code 42P01) or any read fails, it falls back
// to safe SAMPLE data so the UI always renders. It performs NO writes to Drive
// and NO outbound sends. Pattern mirrors app/api/atlas/connectors/route.ts.
// -----------------------------------------------------------------------------

import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

import {
  SAMPLE_BORROWER_FOLDERS,
  SAMPLE_FILES,
  SAMPLE_ROOT_FOLDERS,
  SAMPLE_SUMMARIES,
  allSampleBorrowerFolders,
} from "./sampleData";
import type {
  DriveFile,
  DriveFolder,
  LoanSummary,
} from "./types";

export type LoanBrainSource = "db" | "sample";

export type RootListing = {
  source: LoanBrainSource;
  roots: DriveFolder[];
};

export type FolderListing = {
  source: LoanBrainSource;
  folder: DriveFolder | null;
  subfolders: DriveFolder[];
  files: DriveFile[];
};

// Roots are static pipeline sections. In live mode these map to real Drive
// section folders; for now they are the same labels either way.
export function listRoots(): RootListing {
  return { source: "sample", roots: SAMPLE_ROOT_FOLDERS };
}

export function listFolder(folderId: string): FolderListing {
  // Root section -> its borrower subfolders.
  const root = SAMPLE_ROOT_FOLDERS.find((f) => f.id === folderId);
  if (root) {
    return {
      source: "sample",
      folder: root,
      subfolders: SAMPLE_BORROWER_FOLDERS[folderId] ?? [],
      files: [],
    };
  }
  // Borrower folder -> its files.
  const borrower = allSampleBorrowerFolders().find((f) => f.id === folderId);
  if (borrower) {
    return {
      source: "sample",
      folder: borrower,
      subfolders: [],
      files: SAMPLE_FILES[folderId] ?? [],
    };
  }
  return { source: "sample", folder: null, subfolders: [], files: [] };
}

export function searchBorrowerFolders(query: string): DriveFolder[] {
  const q = query.trim().toLowerCase();
  if (!q) return allSampleBorrowerFolders();
  return allSampleBorrowerFolders().filter((f) =>
    `${f.label} ${f.description ?? ""}`.toLowerCase().includes(q)
  );
}

export function getSampleSummary(folderId: string): LoanSummary | null {
  return SAMPLE_SUMMARIES[folderId] ?? null;
}

export type BoardRow = {
  folderId: string;
  label: string;
  borrowerName: string;
  loanNumber: string | null;
  loanProgram: string | null;
  stage: string;
  stageStatus: string;
  priority: string;
  missingCount: number;
  conditionCount: number;
  driveUrl: string | null;
  rootKind: string;
  // First priority next step from the sample summary, surfaced on the LO card.
  nextStep?: string | null;
};

// Build board rows from the sample summaries. Used by the Ashley / Geraldine /
// LO boards to render demo data until live Drive + DB rows exist.
export function sampleBoardRows(): BoardRow[] {
  const rows: BoardRow[] = [];
  for (const [rootId, folders] of Object.entries(SAMPLE_BORROWER_FOLDERS)) {
    const rootKind = SAMPLE_ROOT_FOLDERS.find((r) => r.id === rootId)?.kind ?? "other";
    for (const folder of folders) {
      const s = SAMPLE_SUMMARIES[folder.id];
      if (!s) continue;
      rows.push({
        folderId: folder.id,
        label: folder.label,
        borrowerName: s.borrowerName,
        loanNumber: s.loanNumber,
        loanProgram: s.loanProgram,
        stage: s.stage,
        stageStatus: s.stageStatus,
        priority: s.priority,
        missingCount: s.documentsMissing.length,
        conditionCount: s.conditions.length,
        driveUrl: s.driveFolderUrl,
        rootKind,
        nextStep: s.nextSteps[0] ?? null,
      });
    }
  }
  return rows;
}

// Attempt to read real loans for this profile (RLS already scopes them). Falls
// back to an empty list when the table is missing. Returns source so the UI can
// show whether it's looking at live data or the sample set.
export async function listLoansForProfile(profile: Profile): Promise<{
  source: LoanBrainSource;
  loans: {
    id: string;
    borrowerName: string | null;
    loan_number: string | null;
    loan_program: string | null;
    stage: string;
    stage_status: string;
    priority: string;
    drive_url: string | null;
    is_sample: boolean;
  }[];
}> {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("loans")
      .select(
        "id,loan_number,loan_program,stage,stage_status,priority,drive_url,is_sample,borrowers(full_name,is_primary)"
      )
      .order("updated_at", { ascending: false })
      .limit(100);

    if (error) {
      // 42P01 = table missing (migrations not applied yet). Any error -> sample.
      return { source: "sample", loans: [] };
    }

    const loans = (data ?? []).map((row) => {
      const borrowers = (row as { borrowers?: { full_name: string; is_primary: boolean }[] }).borrowers ?? [];
      const primary = borrowers.find((b) => b.is_primary) ?? borrowers[0];
      return {
        id: row.id as string,
        borrowerName: primary?.full_name ?? null,
        loan_number: (row.loan_number as string) ?? null,
        loan_program: (row.loan_program as string) ?? null,
        stage: (row.stage as string) ?? "lead",
        stage_status: (row.stage_status as string) ?? "working",
        priority: (row.priority as string) ?? "normal",
        drive_url: (row.drive_url as string) ?? null,
        is_sample: Boolean(row.is_sample),
      };
    });

    return { source: "db", loans };
  } catch {
    return { source: "sample", loans: [] };
  }
}

// LegendsOS v2 — Loan Brain shared types
// Pure types only. No I/O, no secrets.

export type StageStatus = 'blocked' | 'working' | 'done' | 'seen';

export type LoanStage =
  | 'lead'
  | 'prospect'
  | 'application'
  | 'processing'
  | 'underwriting'
  | 'approved'
  | 'clear_to_close'
  | 'funded'
  | 'closed'
  | 'past_client'
  | 'withdrawn';

export type DocStatus = 'received' | 'missing' | 'pending' | 'waived';

export type DocCategory =
  | 'application'
  | 'income'
  | 'assets'
  | 'credit'
  | 'property'
  | 'title'
  | 'hoi'
  | 'aus'
  | 'conditions'
  | 'disclosures'
  | 'correspondence'
  | 'other';

export type DriveFolderKind =
  | 'root'
  | 'active_loans'
  | 'leads'
  | 'prospects'
  | 'past_clients'
  | 'loan_brain'
  | 'uw_guides'
  | 'borrower'
  | 'other';

export type DriveConnectionChecklistItem = {
  label: string;
  done: boolean;
};

export type DriveConnectionStatus = {
  connected: boolean;
  mode: 'live' | 'sample';
  reason: string;
  identityNeeded: string;
  scopeNeeded: string;
  rootFolderLabel: string;
  rootFolderUrl: string | null;
  readOnly: true;
  lastCheckedAt: string | null;
  checklist: DriveConnectionChecklistItem[];
};

export type DriveFolder = {
  id: string;
  kind: DriveFolderKind;
  label: string;
  description?: string;
  driveFolderId: string | null;
  driveUrl: string | null;
  isSample: boolean;
  childCount?: number;
};

export type DriveFile = {
  id: string;
  name: string;
  category: DocCategory;
  status: DocStatus;
  driveFileId: string | null;
  driveUrl: string | null;
  isSample: boolean;
};

export type LoanContactLite = {
  type: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
};

export type LoanSummary = {
  loanId: string | null;
  folderId: string;
  isSample: boolean;
  borrowerName: string;
  coBorrowerName: string | null;
  loanNumber: string | null;
  loanProgram: string | null;
  loanPurpose: string | null;
  propertyAddress: string | null;
  lender: string | null;
  stage: LoanStage;
  stageStatus: StageStatus;
  priority: string;
  driveFolderUrl: string | null;
  contacts: LoanContactLite[];
  documentsReceived: { name: string; category: DocCategory }[];
  documentsMissing: { name: string; category: DocCategory }[];
  conditions: { source: string; description: string; status: string; citationSource: string | null }[];
  risks: string[];
  nextSteps: string[];
};

export type GeneratorKind =
  | 'loan_summary'
  | 'processor_handoff'
  | 'missing_items'
  | 'ashley_email'
  | 'condition_plan'
  | 'overlay_note'
  | 'pipeline_update';

export type GeneratedDraft = {
  kind: GeneratorKind;
  title: string;
  body: string; // markdown draft
  isDraft: true;
  warnings: string[];
};

export const STAGE_STATUS_TONE: Record<StageStatus, 'danger' | 'warning' | 'info' | 'success'> = {
  blocked: 'danger',
  working: 'warning',
  done: 'info',
  seen: 'success',
};

export const STAGE_STATUS_LABEL: Record<StageStatus, string> = {
  blocked: 'Blocked — needs a human',
  working: 'Working',
  done: 'Done — not yet reviewed',
  seen: 'Seen / handled',
};

import type { LucideIcon } from "lucide-react";
import {
  Brain,
  CheckCircle2,
  Chrome,
  Database,
  FileKey2,
  GitBranch,
  HardDrive,
  KeyRound,
  Mail,
  Megaphone,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Webhook,
} from "lucide-react";

import { getN8nConfigState } from "@/lib/automation/n8n";
import { isWebhookSecretConfigured } from "@/lib/emailIntake/webhook";
import { PUBLIC_ENV } from "@/lib/env";
import { detectMetaConfig } from "@/lib/integrations/meta";
import { getDriveConnectionStatus } from "@/lib/loanbrain/driveStatus";
import type { Profile, UserRole } from "@/types/database";

export type SecurityTone = "ok" | "warn" | "err" | "info" | "off";
export type SecuritySeverity = "critical" | "high" | "medium" | "low";
export type ValidationStatus = "pass" | "watch" | "fail";

export interface SecurityStatusCard {
  title: string;
  status: string;
  tone: SecurityTone;
  detail: string;
  icon: LucideIcon;
}

export interface SecurityFinding {
  id: string;
  surface: string;
  severity: SecuritySeverity;
  status: "fixed" | "mitigated" | "watch" | "open";
  finding: string;
  evidence: string;
  fix: string;
}

export interface SecurityRecommendation {
  id: string;
  priority: "now" | "next" | "later";
  title: string;
  recommendation: string;
  owner: string;
}

export interface SecurityValidationCheck {
  id: string;
  area: string;
  status: ValidationStatus;
  check: string;
  evidence: string;
}

export interface RoleAccessCheck {
  role: UserRole;
  label: string;
  status: ValidationStatus;
  expectedAccess: string;
  deniedAccess: string;
  liveUsers: number;
}

function envPresent(name: string): boolean {
  const raw = process.env[name];
  return Boolean(raw && raw.trim() !== "");
}

function extensionAllowlistConfigured(): boolean {
  return envPresent("LEGENDSOS_BROWSER_EXTENSION_ORIGINS");
}

export function getSecurityStatusCards(): SecurityStatusCard[] {
  const drive = getDriveConnectionStatus();
  const n8n = getN8nConfigState();
  const meta = detectMetaConfig();
  const webhookSecret = isWebhookSecretConfigured();
  const googleOauth = envPresent("GOOGLE_OAUTH_CLIENT_ID") && envPresent("GOOGLE_OAUTH_CLIENT_SECRET");
  const extensionAllowlist = extensionAllowlistConfigured();

  return [
    {
      title: "Authentication status",
      status: PUBLIC_ENV.SUPABASE_URL && PUBLIC_ENV.SUPABASE_PUBLISHABLE_KEY ? "configured" : "setup needed",
      tone: PUBLIC_ENV.SUPABASE_URL && PUBLIC_ENV.SUPABASE_PUBLISHABLE_KEY ? "ok" : "err",
      detail:
        "Protected app routes require Supabase auth via middleware and server-side profile lookup.",
      icon: KeyRound,
    },
    {
      title: "RLS status",
      status: "policy-backed",
      tone: "ok",
      detail:
        "Mortgage, loan memory, Browser Companion, integrations, chat, knowledge, and audit tables have RLS migrations in scope.",
      icon: Database,
    },
    {
      title: "Webhook status",
      status: webhookSecret ? "secret configured" : "not configured",
      tone: webhookSecret ? "ok" : "warn",
      detail:
        "Inbound intake webhooks fail closed through x-legendsos-webhook-secret. No secret value is displayed.",
      icon: Webhook,
    },
    {
      title: "OAuth status",
      status: googleOauth ? "client present" : "setup needed",
      tone: googleOauth ? "info" : "warn",
      detail:
        "Google OAuth presence is detected by env name only. Raw tokens must never be stored in assistant memory.",
      icon: FileKey2,
    },
    {
      title: "Integration status",
      status: [drive.connected, n8n.configured, meta.configured].filter(Boolean).length + "/3 wired",
      tone: drive.connected || n8n.configured || meta.configured ? "info" : "warn",
      detail:
        "Drive, n8n, and Meta are reported as honest wiring status only; live actions remain gated.",
      icon: GitBranch,
    },
    {
      title: "Browser Companion origin",
      status: extensionAllowlist ? "allowlisted" : "web-only until allowlisted",
      tone: extensionAllowlist ? "ok" : "warn",
      detail:
        "Production extension CORS requires LEGENDSOS_BROWSER_EXTENSION_ORIGINS. Same-origin web fallback remains usable.",
      icon: Chrome,
    },
    {
      title: "Assistant Skills",
      status: "RLS planned",
      tone: "info",
      detail:
        "Agent skills are scoped to the owning user or team-shared skills. Runtime tables must be applied before live skill memory.",
      icon: Brain,
    },
  ];
}

export const SECURITY_FINDINGS: SecurityFinding[] = [
  {
    id: "SEC-BC-001",
    surface: "Browser Companion",
    severity: "high",
    status: "fixed",
    finding:
      "Credentialed CORS previously trusted any browser-extension origin, which could expose a signed-in user's captured borrower context to an untrusted extension.",
    evidence:
      "Browser Companion routes return capture/context payloads with Access-Control-Allow-Credentials.",
    fix:
      "Production browser-extension origins now require LEGENDSOS_BROWSER_EXTENSION_ORIGINS. Same-origin app calls remain allowed.",
  },
  {
    id: "SEC-MEM-001",
    surface: "Assistant Memory",
    severity: "high",
    status: "mitigated",
    finding:
      "Loan Memory contains borrower context and must never be globally readable.",
    evidence:
      "loan_memory RLS uses can_view_loan_memory and role/assignment checks; API bundle/events use the RLS server client.",
    fix:
      "Keep all memory reads/writes on user-scoped Supabase clients except service-only background jobs.",
  },
  {
    id: "SEC-LOAN-001",
    surface: "Loan Brain",
    severity: "high",
    status: "mitigated",
    finding:
      "Live loans and borrower rows are sensitive and must be scoped by owner/assigned LO/processor/coordinator.",
    evidence:
      "Mortgage RLS defines can_view_loan and child-table policies inherit from the parent loan.",
    fix:
      "Loan Brain reads through RLS and falls back to sample data when tables are unavailable.",
  },
  {
    id: "SEC-WH-001",
    surface: "Webhook Architecture",
    severity: "medium",
    status: "mitigated",
    finding:
      "Inbound webhooks must not accept unauthenticated Gmail, document, alert, or loan update payloads.",
    evidence:
      "All app/api/webhooks/* routes call verifyWebhookSecret before parsing or writing payloads.",
    fix:
      "Shared-secret verification fails closed when the server secret is missing or mismatched.",
  },
  {
    id: "SEC-OAUTH-001",
    surface: "Gmail / Drive / Social OAuth",
    severity: "medium",
    status: "watch",
    finding:
      "OAuth token persistence is intentionally not implemented in client-readable tables; future token storage is the main risk area.",
    evidence:
      "Integration schema stores status and non-secret metadata only. Comments prohibit token columns.",
    fix:
      "Add a service-role-only token vault table before enabling real Gmail/Drive/Meta refresh-token storage.",
  },
  {
    id: "SEC-IMP-001",
    surface: "Impersonation",
    severity: "medium",
    status: "mitigated",
    finding:
      "Impersonation must not swap Supabase sessions or write as the target user.",
    evidence:
      "Impersonation is UI-level only, owner-gated, org-scoped, HttpOnly cookie based, and audited.",
    fix:
      "Continue blocking target-user session swaps; use impersonation only for role preview.",
  },
  {
    id: "SEC-SKILL-001",
    surface: "Assistant Skills",
    severity: "medium",
    status: "watch",
    finding:
      "Reusable assistant skills can become sensitive if steps or examples include borrower workflow details.",
    evidence:
      "Agent runtime RLS scopes agent_skills by owner or team-shared status, and skill usage is append-only.",
    fix:
      "Keep skill bodies free of OAuth tokens and borrower PII; promote only sanitized skills to team shared.",
  },
];

export const SECURITY_RECOMMENDATIONS: SecurityRecommendation[] = [
  {
    id: "REC-001",
    priority: "now",
    title: "Configure Browser Companion extension origins",
    recommendation:
      "Set LEGENDSOS_BROWSER_EXTENSION_ORIGINS to the exact chrome-extension:// or moz-extension:// origins before using the extension with borrower data in production.",
    owner: "Owner",
  },
  {
    id: "REC-002",
    priority: "now",
    title: "Apply all security migrations before live borrower data",
    recommendation:
      "Confirm Browser Companion, Loan Memory, mortgage, email intake, and integrations RLS migrations are applied in Supabase.",
    owner: "Owner",
  },
  {
    id: "REC-003",
    priority: "next",
    title: "Add service-only OAuth token vault",
    recommendation:
      "Persist future Gmail, Drive, and Meta refresh tokens only in a separate service-role-only table with no authenticated read policy.",
    owner: "Engineering",
  },
  {
    id: "REC-004",
    priority: "next",
    title: "Promote validation checks into automated tests",
    recommendation:
      "Add integration tests that sign in as owner, LO, processor, and coordinator and assert cross-user memory/loan denials.",
    owner: "Engineering",
  },
];

export function getSecurityValidationChecks(): SecurityValidationCheck[] {
  return [
    {
      id: "VAL-AUTH-001",
      area: "Authentication",
      status: PUBLIC_ENV.SUPABASE_URL && PUBLIC_ENV.SUPABASE_PUBLISHABLE_KEY ? "pass" : "fail",
      check: "Protected app shell requires Supabase auth.",
      evidence: "app/(app)/layout.tsx redirects unauthenticated users to /login.",
    },
    {
      id: "VAL-RLS-001",
      area: "RLS",
      status: "pass",
      check: "Users cannot access other users' loans.",
      evidence: "loans_select_visible and can_view_loan scope by owner_id, assigned_processor_id, assigned_coordinator_id, or admin/owner.",
    },
    {
      id: "VAL-MEM-001",
      area: "Assistant Memory",
      status: "pass",
      check: "Users cannot access other users' memory.",
      evidence: "loan_memory_select and can_view_loan_memory scope by owner, assigned roles, or linked loan visibility.",
    },
    {
      id: "VAL-BC-001",
      area: "Browser Companion",
      status: extensionAllowlistConfigured() ? "pass" : "watch",
      check: "Browser Companion cannot expose borrower data to arbitrary extensions.",
      evidence: extensionAllowlistConfigured()
        ? "Production extension CORS is allowlist-gated."
        : "Same-origin fallback is safe; production extension use requires LEGENDSOS_BROWSER_EXTENSION_ORIGINS.",
    },
    {
      id: "VAL-WH-001",
      area: "Webhooks",
      status: isWebhookSecretConfigured() ? "pass" : "watch",
      check: "Webhook routes require validation.",
      evidence: "All intake webhook routes call verifyWebhookSecret before writes.",
    },
    {
      id: "VAL-AUDIT-001",
      area: "Audit Logs",
      status: "pass",
      check: "Audit logs exist for sensitive actions.",
      evidence: "recordAudit covers social publish requests and impersonation; integration_audit_log covers Browser Companion capture metadata.",
    },
    {
      id: "VAL-SKILL-001",
      area: "Assistant Skills",
      status: "watch",
      check: "Assistant skills are not a token or borrower-data store.",
      evidence:
        "agent_skills RLS scopes private skills to user_id and team-shared skills to current_org_id; live policy state still needs Supabase role testing.",
    },
  ];
}

export function getRoleAccessChecks(profiles: Pick<Profile, "role">[]): RoleAccessCheck[] {
  const count = (role: UserRole) => profiles.filter((p) => p.role === role).length;
  return [
    {
      role: "owner",
      label: "Owner access",
      status: count("owner") > 0 ? "pass" : "watch",
      expectedAccess: "Org-wide admin, audit, setup, users, integrations, and oversight reads.",
      deniedAccess: "Cannot impersonate owner accounts; no real target-user Supabase session swap.",
      liveUsers: count("owner"),
    },
    {
      role: "loan_officer",
      label: "LO access",
      status: "pass",
      expectedAccess: "Own loans, own memory, own Browser Companion captures, own drafts.",
      deniedAccess: "Other LO memory, other LO loans, admin setup, provider secrets.",
      liveUsers: count("loan_officer"),
    },
    {
      role: "processor",
      label: "Processor access",
      status: "pass",
      expectedAccess: "Loans and memory assigned to the processor plus processing cockpit.",
      deniedAccess: "Unassigned borrower files, owner setup, social account management.",
      liveUsers: count("processor"),
    },
    {
      role: "coordinator",
      label: "Coordinator access",
      status: "pass",
      expectedAccess: "Loans and memory assigned to the coordinator plus coordinator board.",
      deniedAccess: "Unassigned borrower files, owner setup, token/admin surfaces.",
      liveUsers: count("coordinator"),
    },
  ];
}

export function securitySurfaceIcon(surface: string): LucideIcon {
  if (surface.includes("Browser")) return Chrome;
  if (surface.includes("Memory")) return Brain;
  if (surface.includes("Loan")) return HardDrive;
  if (surface.includes("Webhook")) return Webhook;
  if (surface.includes("Gmail")) return Mail;
  if (surface.includes("Social")) return Megaphone;
  if (surface.includes("Impersonation")) return UserCheck;
  if (surface.includes("OAuth")) return FileKey2;
  if (surface.includes("fixed")) return CheckCircle2;
  if (surface.includes("open")) return ShieldAlert;
  return ShieldCheck;
}

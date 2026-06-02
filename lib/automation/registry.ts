import fs from "node:fs";
import path from "node:path";

import { getN8nConfigState, isN8nCallbackSecretConfigured } from "@/lib/automation/n8n";
import { isN8nConfigured } from "@/lib/automation/n8n-bridge";
import { isZapierMcpConfigured } from "@/lib/automation/zapier-mcp";
import { getServerEnv } from "@/lib/env";
import { detectMetaConfig } from "@/lib/integrations/meta";
import {
  PLANNED_WEBHOOK_PATH,
  SCHEDULE_DESCRIPTORS,
} from "@/lib/loanMemory/scheduleConfig";

export type AutomationReadiness = "ready" | "configured" | "partial" | "blocked" | "off";
export type AutomationSafety = "read_only" | "queued" | "approval_required" | "disabled";

export interface AutomationRegistryEntry {
  id: string;
  label: string;
  category:
    | "webhook"
    | "integration"
    | "scheduled_job"
    | "n8n_contract"
    | "browser_companion"
    | "approval";
  status: AutomationReadiness;
  safety: AutomationSafety;
  liveWritesEnabled: boolean;
  route?: string;
  contract?: string;
  owner: string;
  currentBehavior: string;
  activationGate: string;
  preparedFor: string[];
}

export interface AutomationRegistrySnapshot {
  generated_at: string;
  summary: {
    total: number;
    ready: number;
    partial: number;
    blocked: number;
    disabled: number;
    live_writes_enabled: number;
  };
  status: {
    webhook: AutomationReadiness;
    n8n: AutomationReadiness;
    zapier: AutomationReadiness;
    google: AutomationReadiness;
    meta: AutomationReadiness;
    email: AutomationReadiness;
    drive: AutomationReadiness;
    browser_companion: AutomationReadiness;
  };
  readiness: {
    n8n_api_configured: boolean;
    n8n_callback_signature_configured: boolean;
    n8n_webhook_count: number;
    n8n_workflow_files: number;
    n8n_workflow_files_active: number;
    zapier_mcp_configured: boolean;
    google_oauth_configured: boolean;
    google_writes_enabled: boolean;
    meta_configured: boolean;
    meta_writes_enabled: boolean;
    live_social_publish_enabled: boolean;
    live_email_send_enabled: boolean;
    scheduled_jobs_activated: boolean;
  };
  entries: AutomationRegistryEntry[];
}

function envPresent(name: string): boolean {
  const v = process.env[name];
  return Boolean(v && v.trim() !== "");
}

function workflowStats(): { files: number; active: number } {
  const dir = path.join(process.cwd(), "n8n", "workflows");
  try {
    const files = fs
      .readdirSync(dir)
      .filter((name) => name.endsWith(".json"));
    let active = 0;
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(dir, file), "utf8");
        const parsed = JSON.parse(raw) as { active?: unknown };
        if (parsed.active === true) active += 1;
      } catch {
        // Treat unreadable workflow files as not active. The build should not
        // fail because an imported n8n fixture is malformed.
      }
    }
    return { files: files.length, active };
  } catch {
    return { files: 0, active: 0 };
  }
}

function rollup(entries: AutomationRegistryEntry[]) {
  return {
    total: entries.length,
    ready: entries.filter((e) => e.status === "ready" || e.status === "configured").length,
    partial: entries.filter((e) => e.status === "partial").length,
    blocked: entries.filter((e) => e.status === "blocked").length,
    disabled: entries.filter((e) => e.status === "off").length,
    live_writes_enabled: entries.filter((e) => e.liveWritesEnabled).length,
  };
}

function aggregateStatus(
  entries: AutomationRegistryEntry[],
  category: AutomationRegistryEntry["category"]
): AutomationReadiness {
  const scoped = entries.filter((e) => e.category === category);
  if (scoped.length === 0) return "off";
  if (scoped.some((e) => e.status === "blocked")) return "blocked";
  if (scoped.some((e) => e.status === "partial")) return "partial";
  if (scoped.some((e) => e.status === "ready" || e.status === "configured")) return "ready";
  return "off";
}

export function buildAutomationRegistry(): AutomationRegistrySnapshot {
  const env = getServerEnv();
  const n8n = getN8nConfigState();
  const meta = detectMetaConfig();
  const workflows = workflowStats();
  const n8nWebhookCount = Object.values(env.N8N_WEBHOOKS).filter(Boolean).length;
  const googleOauthConfigured =
    envPresent("GOOGLE_OAUTH_CLIENT_ID") && envPresent("GOOGLE_OAUTH_CLIENT_SECRET");
  const driveNeedsReviewConfigured = envPresent("LEGENDSOS_NEEDS_REVIEW_FOLDER_ID");
  const liveSocial = env.SAFETY.allowLiveSocialPublish;
  const liveEmail = env.SAFETY.allowLiveEmailSend;
  const callbackSigned = isN8nCallbackSecretConfigured();
  const n8nApiConfigured = isN8nConfigured();
  const zapierConfigured = isZapierMcpConfigured();

  const entries: AutomationRegistryEntry[] = [
    {
      id: "webhook_email_intake",
      label: "Gmail intake webhook",
      category: "webhook",
      status: envPresent("LEGENDSOS_WEBHOOK_SECRET") ? "ready" : "blocked",
      safety: "read_only",
      liveWritesEnabled: false,
      route: "/api/webhooks/email-intake",
      owner: "Email Intake",
      currentBehavior:
        "Verifies the shared-secret header, records message metadata, classifies, and queues review states.",
      activationGate: "LEGENDSOS_WEBHOOK_SECRET plus inactive n8n Gmail workflows reviewed per mailbox.",
      preparedFor: ["Gmail intake"],
    },
    {
      id: "webhook_document_intake",
      label: "Document intake webhook",
      category: "webhook",
      status: envPresent("LEGENDSOS_WEBHOOK_SECRET") ? "ready" : "blocked",
      safety: "approval_required",
      liveWritesEnabled: false,
      route: "/api/webhooks/document-intake",
      owner: "Email Intake",
      currentBehavior:
        "Records attachment metadata into pending/suspicious review queues. It does not download, upload, or file documents.",
      activationGate: "Shared-secret header and human review queue.",
      preparedFor: ["Document updates", "Drive intake"],
    },
    {
      id: "webhook_loan_update",
      label: "Loan update webhook",
      category: "webhook",
      status: envPresent("LEGENDSOS_WEBHOOK_SECRET") ? "ready" : "blocked",
      safety: "approval_required",
      liveWritesEnabled: false,
      route: "/api/webhooks/loan-update",
      owner: "Loan Brain",
      currentBehavior:
        "Records suggested or confirmed loan matches on intake messages. It does not mutate the loan file.",
      activationGate: "Shared-secret header and human review of matched messages.",
      preparedFor: ["Loan updates", "Task updates"],
    },
    {
      id: "webhook_alert_intake",
      label: "Internal alert webhook",
      category: "webhook",
      status: envPresent("LEGENDSOS_WEBHOOK_SECRET") ? "ready" : "blocked",
      safety: "approval_required",
      liveWritesEnabled: false,
      route: "/api/webhooks/alert-intake",
      owner: "Email Intake",
      currentBehavior:
        "Queues internal alerts as pending. Dispatch confirmation only stamps an already approved internal alert.",
      activationGate: "Human approval before dispatch confirmation can be recorded.",
      preparedFor: ["Task updates", "Automation approvals"],
    },
    {
      id: "n8n_dispatch",
      label: "n8n outbound dispatch",
      category: "n8n_contract",
      status:
        n8n.configured && callbackSigned
          ? "ready"
          : n8n.base_url_present || n8nWebhookCount > 0
          ? "partial"
          : "off",
      safety: "queued",
      liveWritesEnabled: liveSocial || liveEmail,
      contract: "docs/AUTOMATION.md",
      owner: "Automation",
      currentBehavior:
        "Creates automation_jobs rows. External POST happens only when caller dispatch is true and a webhook URL exists.",
      activationGate:
        "N8N base/webhooks, N8N_WEBHOOK_SECRET for callbacks, and explicit ALLOW_LIVE_* flags.",
      preparedFor: ["n8n status", "Retry handling", "Failure handling", "Execution history"],
    },
    {
      id: "zapier_mcp",
      label: "Zapier MCP",
      category: "integration",
      status: zapierConfigured ? "configured" : "off",
      safety: "disabled",
      liveWritesEnabled: false,
      owner: "Automation",
      currentBehavior:
        "Stub only. triggerZap and getZapStatus return not_configured until a Zapier MCP key is set and implementation is added.",
      activationGate: "ZAP_MCP_KEY or ZAPIER_MCP_KEY plus a real MCP implementation.",
      preparedFor: ["Zapier status"],
    },
    {
      id: "google_oauth",
      label: "Google OAuth",
      category: "integration",
      status: googleOauthConfigured ? "partial" : "off",
      safety: "read_only",
      liveWritesEnabled: false,
      route: "/api/integrations/connect",
      owner: "Integrations",
      currentBehavior:
        "Returns setup_needed or an OAuth authorize URL. Token exchange and server-side token storage are deferred.",
      activationGate: "GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, callback/token storage implementation.",
      preparedFor: ["Google status", "Gmail intake", "Drive intake", "Calendar automation"],
    },
    {
      id: "google_drive_needs_review",
      label: "Drive Needs Review router",
      category: "integration",
      status: driveNeedsReviewConfigured ? "partial" : "off",
      safety: "approval_required",
      liveWritesEnabled: false,
      contract: "n8n/workflows/attachment-needs-review-router.json",
      owner: "Email Intake",
      currentBehavior:
        "Prepared n8n workflow can upload unmatched files to one Needs Review folder only; app endpoint records metadata.",
      activationGate:
        "LEGENDSOS_NEEDS_REVIEW_FOLDER_ID, scoped Drive credential, owner review, inactive workflow activation.",
      preparedFor: ["Drive status", "Drive intake", "Document updates"],
    },
    {
      id: "meta_social",
      label: "Meta social publishing",
      category: "integration",
      status: meta.configured ? "configured" : "off",
      safety: "disabled",
      liveWritesEnabled: meta.paid_enabled,
      owner: "Social Studio",
      currentBehavior:
        "Meta connector is a disabled-by-default stub. No outbound Meta calls are made by this module.",
      activationGate:
        "Meta env presence, account connection record, publish switch, and ALLOW_LIVE_SOCIAL_PUBLISH.",
      preparedFor: ["Meta status", "Social publishing"],
    },
    {
      id: "email_send",
      label: "Email send workflow",
      category: "integration",
      status: env.N8N_WEBHOOKS.email_send ? "configured" : "off",
      safety: "queued",
      liveWritesEnabled: liveEmail,
      owner: "Email Studio",
      currentBehavior:
        "Requests create email_campaigns and automation_jobs. Sending remains queued unless ALLOW_LIVE_EMAIL_SEND is true.",
      activationGate: "N8N_WEBHOOK_EMAIL_SEND plus ALLOW_LIVE_EMAIL_SEND.",
      preparedFor: ["Email status", "Automation approvals"],
    },
    {
      id: "social_publish",
      label: "Social publish workflow",
      category: "integration",
      status: env.N8N_WEBHOOKS.social_publish ? "configured" : "off",
      safety: "queued",
      liveWritesEnabled: liveSocial,
      owner: "Social Studio",
      currentBehavior:
        "Scheduled posts create automation_jobs. Publishing remains queued unless ALLOW_LIVE_SOCIAL_PUBLISH is true.",
      activationGate: "N8N_WEBHOOK_SOCIAL_PUBLISH plus ALLOW_LIVE_SOCIAL_PUBLISH.",
      preparedFor: ["Social publishing", "Automation approvals"],
    },
    {
      id: "browser_companion_capture",
      label: "Browser Companion capture",
      category: "browser_companion",
      status: "partial",
      safety: "read_only",
      liveWritesEnabled: false,
      route: "/api/browser-companion/capture",
      owner: "Browser Companion",
      currentBehavior:
        "Authenticated extension captures safe portal context, stores it when provisioned, and routes to Atlas. No tokens are stored.",
      activationGate: "Browser Companion tables provisioned and user signed in with app session cookies.",
      preparedFor: ["Browser Companion automation paths", "Audit logs"],
    },
    {
      id: "loan_memory_schedule",
      label: "Loan Memory scheduled jobs",
      category: "scheduled_job",
      status: "off",
      safety: "disabled",
      liveWritesEnabled: false,
      route: PLANNED_WEBHOOK_PATH,
      owner: "Loan Memory",
      currentBehavior:
        "Typed descriptors only. No cron is registered, no n8n workflow is enabled, and no schedule route exists.",
      activationGate: "Future owner approval, route implementation, secret verification, and dry-run validation.",
      preparedFor: SCHEDULE_DESCRIPTORS.map((job) => job.label),
    },
    {
      id: "automation_approvals",
      label: "Human approval queues",
      category: "approval",
      status: "partial",
      safety: "approval_required",
      liveWritesEnabled: false,
      owner: "Operations",
      currentBehavior:
        "Approval queues exist across loan_approvals, email-intake alerts, and queued automation_jobs; the Control Center surfaces them together.",
      activationGate: "Human owner/admin action. No webhook may self-approve.",
      preparedFor: ["Automation approvals", "Failure handling", "Retry handling"],
    },
  ];

  return {
    generated_at: new Date().toISOString(),
    summary: rollup(entries),
    status: {
      webhook: aggregateStatus(entries, "webhook"),
      n8n:
        n8n.configured && callbackSigned
          ? "ready"
          : n8n.base_url_present || n8nWebhookCount > 0
          ? "partial"
          : "off",
      zapier: zapierConfigured ? "configured" : "off",
      google: googleOauthConfigured ? "partial" : "off",
      meta: meta.configured ? (meta.paid_enabled ? "ready" : "configured") : "off",
      email: env.N8N_WEBHOOKS.email_send ? (liveEmail ? "ready" : "configured") : "off",
      drive: driveNeedsReviewConfigured ? "partial" : "off",
      browser_companion: aggregateStatus(entries, "browser_companion"),
    },
    readiness: {
      n8n_api_configured: n8nApiConfigured,
      n8n_callback_signature_configured: callbackSigned,
      n8n_webhook_count: n8nWebhookCount,
      n8n_workflow_files: workflows.files,
      n8n_workflow_files_active: workflows.active,
      zapier_mcp_configured: zapierConfigured,
      google_oauth_configured: googleOauthConfigured,
      google_writes_enabled: false,
      meta_configured: meta.configured,
      meta_writes_enabled: meta.paid_enabled,
      live_social_publish_enabled: liveSocial,
      live_email_send_enabled: liveEmail,
      scheduled_jobs_activated: false,
    },
    entries,
  };
}

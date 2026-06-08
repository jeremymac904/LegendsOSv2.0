import fs from "node:fs";
import path from "node:path";

import {
  N8N_WEBHOOK_ENV_VARS,
  N8N_WEBHOOK_KEYS,
  type N8nWebhookKey,
  getWebhookUrl,
} from "@/lib/automation/n8n";

export interface N8nWebhookStatus {
  key: N8nWebhookKey;
  env_var: string;
  present: boolean;
}

export interface LocalN8nWorkflowEntry {
  file: string;
  name: string;
  active: boolean;
  node_count: number;
  credential_reference_count: number;
  credential_placeholder_count: number;
  env_reference_count: number;
  env_references: string[];
  webhook_paths: string[];
}

export interface N8nJobSummary {
  id: string;
  user_id: string | null;
  organization_id: string | null;
  job_type: string;
  module: string | null;
  target_table: string | null;
  target_id: string | null;
  inferred_webhook_key: N8nWebhookKey | null;
  webhook_configured: boolean;
  webhook_url_present: boolean;
  status: string;
  attempts: number;
  created_at: string | null;
  updated_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  last_error: string | null;
}

export interface N8nDispatchLogSummary {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  created_at: string | null;
  metadata: Record<string, unknown>;
}

interface JobLike {
  id?: unknown;
  user_id?: unknown;
  organization_id?: unknown;
  job_type?: unknown;
  module?: unknown;
  target_table?: unknown;
  target_id?: unknown;
  payload?: unknown;
  status?: unknown;
  attempts?: unknown;
  webhook_url?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  started_at?: unknown;
  completed_at?: unknown;
  last_error?: unknown;
}

interface AuditLike {
  id?: unknown;
  action?: unknown;
  target_type?: unknown;
  target_id?: unknown;
  created_at?: unknown;
  metadata?: unknown;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function objectPayload(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isWebhookKey(value: unknown): value is N8nWebhookKey {
  return (
    typeof value === "string" &&
    (N8N_WEBHOOK_KEYS as string[]).includes(value)
  );
}

export function buildN8nWebhookStatuses(): N8nWebhookStatus[] {
  return N8N_WEBHOOK_KEYS.map((key) => ({
    key,
    env_var: N8N_WEBHOOK_ENV_VARS[key],
    present: Boolean(getWebhookUrl(key)),
  }));
}

export function listLocalN8nWorkflows(): LocalN8nWorkflowEntry[] {
  const dir = path.join(process.cwd(), "n8n", "workflows");
  let files: string[] = [];
  try {
    files = fs.readdirSync(dir).filter((name) => name.endsWith(".json")).sort();
  } catch {
    return [];
  }

  return files.flatMap((file) => {
    const fullPath = path.join(dir, file);
    try {
      const raw = fs.readFileSync(fullPath, "utf8");
      const parsed = JSON.parse(raw) as {
        name?: unknown;
        active?: unknown;
        nodes?: Array<{
          credentials?: Record<string, { id?: string; name?: string }>;
          parameters?: Record<string, unknown>;
          webhookId?: unknown;
        }>;
      };
      const nodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
      const credentialRefs = nodes.flatMap((node) =>
        Object.values(node.credentials ?? {})
      );
      const envReferences = Array.from(
        new Set(
          Array.from(raw.matchAll(/\$env\.([A-Z0-9_]+)/g)).map(
            (match) => match[1]
          )
        )
      ).sort();
      const webhookPaths = Array.from(
        new Set(
          nodes
            .flatMap((node) => [
              stringOrNull(node.webhookId),
              stringOrNull(node.parameters?.path),
            ])
            .filter((value): value is string => Boolean(value))
        )
      ).sort();

      return [
        {
          file,
          name:
            typeof parsed.name === "string"
              ? parsed.name
              : file.replace(/\.json$/, ""),
          active: parsed.active === true,
          node_count: nodes.length,
          credential_reference_count: credentialRefs.length,
          credential_placeholder_count: credentialRefs.filter(
            (ref) => ref.id === "SET_IN_N8N" || ref.name === "SET_IN_N8N"
          ).length,
          env_reference_count: envReferences.length,
          env_references: envReferences,
          webhook_paths: webhookPaths,
        },
      ];
    } catch {
      return [];
    }
  });
}

export function inferN8nWebhookKey(job: JobLike): N8nWebhookKey | null {
  const payload = objectPayload(job.payload);
  if (isWebhookKey(payload.webhook_key)) return payload.webhook_key;

  const jobType = String(job.job_type ?? "");
  const moduleName = String(job.module ?? "");
  const targetTable = String(job.target_table ?? "");

  if (
    jobType === "social_publish" ||
    moduleName === "social" ||
    targetTable === "social_posts"
  ) {
    return "social_publish";
  }
  if (
    jobType === "email_send" ||
    jobType === "email_test_send" ||
    moduleName === "email" ||
    targetTable === "email_campaigns"
  ) {
    return "email_send";
  }
  if (jobType === "daily_usage") return "daily_usage";
  if (jobType === "provider_health") return "provider_health";
  if (jobType === "content_reminder") return "content_reminder";
  if (jobType === "failed_publish_recovery") return "failed_publish_recovery";
  return null;
}

export function summarizeN8nJob(row: JobLike): N8nJobSummary {
  const inferred = inferN8nWebhookKey(row);
  return {
    id: String(row.id ?? ""),
    user_id: stringOrNull(row.user_id),
    organization_id: stringOrNull(row.organization_id),
    job_type: String(row.job_type ?? "automation"),
    module: stringOrNull(row.module),
    target_table: stringOrNull(row.target_table),
    target_id: stringOrNull(row.target_id),
    inferred_webhook_key: inferred,
    webhook_configured: inferred ? Boolean(getWebhookUrl(inferred)) : false,
    webhook_url_present: Boolean(row.webhook_url),
    status: String(row.status ?? "unknown"),
    attempts: typeof row.attempts === "number" ? row.attempts : 0,
    created_at: stringOrNull(row.created_at),
    updated_at: stringOrNull(row.updated_at),
    started_at: stringOrNull(row.started_at),
    completed_at: stringOrNull(row.completed_at),
    last_error: stringOrNull(row.last_error),
  };
}

const LOG_METADATA_KEYS = new Set([
  "dispatch",
  "gate_reason",
  "job_id",
  "job_reason",
  "job_status",
  "new_job_id",
  "original_job_id",
  "reason",
  "status",
]);

export function summarizeDispatchLog(row: AuditLike): N8nDispatchLogSummary {
  const metadata = objectPayload(row.metadata);
  const safeMetadata = Object.fromEntries(
    Object.entries(metadata).filter(([key]) => LOG_METADATA_KEYS.has(key))
  );
  return {
    id: String(row.id ?? ""),
    action: String(row.action ?? "audit"),
    target_type: stringOrNull(row.target_type),
    target_id: stringOrNull(row.target_id),
    created_at: stringOrNull(row.created_at),
    metadata: safeMetadata,
  };
}

export function allowedUserAutomations() {
  return [
    {
      id: "social_publish",
      label: "Social post scheduling",
      route: "/social",
      currentBehavior:
        "Creates a social post and queues n8n dispatch only when live-social and destination gates allow it.",
    },
    {
      id: "email_send",
      label: "Email send requests",
      route: "/email",
      currentBehavior:
        "Creates an email campaign and queues n8n dispatch only when live-email gates allow it.",
    },
    {
      id: "browser_companion_capture",
      label: "Browser Companion captures",
      route: "/browser-companion",
      currentBehavior:
        "Captures portal context for review and routing. It does not store tokens or call n8n directly.",
    },
  ];
}

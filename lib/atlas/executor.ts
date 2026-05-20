// Atlas executor — runs a planner output (or a regex-fast-path intent) through
// the typed registry handlers.
//
// Responsibilities:
//   * resolve the tool id to a registry entry
//   * run the readiness check; surface a plain-English missing-env-var error
//   * role check
//   * input validation via the entry's zod schema
//   * try/catch around the handler — surface plain-English errors only
//   * write audit_logs (when entry.audit) + a usage_events row
//
// Anything the executor returns is safe to JSON-encode and send to the client.

import { getToolEntry, type AtlasToolContext, type AtlasToolResult, type ToolEntry } from "@/lib/atlas/registry";
import { getSupabaseServerClient, getSupabaseServiceClient } from "@/lib/supabase/server";
import { logUsage, recordAudit } from "@/lib/usage";
import type { Profile } from "@/types/database";

export interface ExecArgs {
  tool_id: string;
  input: unknown;
  profile: Profile;
  thread_id: string | null;
  assistant_id: string | null;
}

export interface ExecOk {
  ok: true;
  tool_id: string;
  result: Extract<AtlasToolResult, { ok: true }>;
}

export interface ExecErr {
  ok: false;
  tool_id: string;
  error: string;
  message: string;
}

export type ExecResult = ExecOk | ExecErr;

function friendlyMissingEnv(toolName: string, missing: string[]): string {
  if (missing.length === 1) {
    return `I can't run "${toolName}" yet — ${missing[0]} isn't set in Netlify env. Add it, then try again.`;
  }
  return `I can't run "${toolName}" yet — these env vars aren't set in Netlify env: ${missing.join(", ")}. Add them, then try again.`;
}

function plainErrorFromException(toolName: string, err: unknown): string {
  // We DELIBERATELY do not echo the raw exception text — it can contain
  // database row payloads and env values. The plain-English message points
  // the user at the studio they can use to retry manually.
  if (err instanceof Error && /row-level security|policy/i.test(err.message)) {
    return `I tried to run "${toolName}" but Supabase blocked it (row-level security). That usually means your role doesn't have write access — ask Jeremy to check.`;
  }
  return `I tried to run "${toolName}" but the server hit an unexpected error. Try opening the matching studio (e.g. /social, /email, /calendar) to do it manually.`;
}

export async function executeTool(args: ExecArgs): Promise<ExecResult> {
  const entry: ToolEntry | undefined = getToolEntry(args.tool_id);
  if (!entry) {
    return {
      ok: false,
      tool_id: args.tool_id,
      error: "unknown_tool",
      message: `I don't know a tool called "${args.tool_id}".`,
    };
  }

  // Role gate.
  if (!entry.rolesAllowed.includes(args.profile.role as never)) {
    return {
      ok: false,
      tool_id: args.tool_id,
      error: "role_not_allowed",
      message: `Your role (${args.profile.role}) can't run "${entry.name}". Ask the owner if you should have access.`,
    };
  }

  // Readiness check — connector / env presence (NAMES only, never values).
  const readiness = entry.readinessCheck();
  if (!readiness.ready) {
    return {
      ok: false,
      tool_id: args.tool_id,
      error: "tool_not_ready",
      message: friendlyMissingEnv(entry.name, readiness.missing ?? []),
    };
  }

  // Input validation.
  const parsed = entry.inputSchema.safeParse(args.input ?? {});
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    return {
      ok: false,
      tool_id: args.tool_id,
      error: "invalid_input",
      message: `I couldn't run "${entry.name}" because the planner's input was invalid: ${issues}.`,
    };
  }

  const supabase = getSupabaseServerClient();
  let serviceClient: ReturnType<typeof getSupabaseServiceClient> | null = null;
  try {
    serviceClient = getSupabaseServiceClient();
  } catch {
    // SUPABASE_SECRET_KEY missing — handlers that need it should bail out
    // gracefully via readinessCheck. Keep the executor resilient by passing
    // a non-functional placeholder rather than throwing here.
    serviceClient = null as unknown as ReturnType<typeof getSupabaseServiceClient>;
  }
  const ctx: AtlasToolContext = {
    profile: args.profile,
    supabase,
    serviceClient: serviceClient as ReturnType<typeof getSupabaseServiceClient>,
    thread_id: args.thread_id,
    assistant_id: args.assistant_id,
  };

  let result: AtlasToolResult;
  try {
    result = await entry.handler(parsed.data, ctx);
  } catch (err) {
    console.error(`atlas_tool[${entry.id}] threw`, err);
    return {
      ok: false,
      tool_id: args.tool_id,
      error: "handler_threw",
      message: plainErrorFromException(entry.name, err),
    };
  }

  if (!result.ok) {
    return {
      ok: false,
      tool_id: args.tool_id,
      error: result.error,
      message: result.message,
    };
  }

  // Best-effort audit + usage logging. Never block the response on these.
  try {
    if (entry.audit) {
      await recordAudit({
        actor: args.profile,
        action: "atlas_tool_call",
        target_type: result.card.kind,
        target_id: itemIdFromCard(result.card),
        metadata: { tool_id: entry.id, thread_id: args.thread_id ?? null },
      });
    }
  } catch (e) {
    console.error("atlas audit failed", e);
  }
  try {
    await logUsage(args.profile, {
      module: "atlas",
      event_type: "atlas_tool_call",
      metadata: {
        tool_id: entry.id,
        thread_id: args.thread_id ?? null,
        item_id: itemIdFromCard(result.card),
        card_kind: result.card.kind,
      },
    });
  } catch (e) {
    console.error("atlas usage log failed", e);
  }

  return { ok: true, tool_id: args.tool_id, result };
}

// Pull a stable item_id from a card when one exists. Used only for analytics
// + audit metadata. Returns null for read-only / status cards that don't map
// to a single DB row.
function itemIdFromCard(card: unknown): string | null {
  if (!card || typeof card !== "object") return null;
  const c = card as Record<string, unknown>;
  if (typeof c.item_id === "string") return c.item_id;
  if (typeof c.social_post_id === "string") return c.social_post_id;
  return null;
}

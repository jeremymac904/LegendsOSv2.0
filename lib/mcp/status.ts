// MCP status — combined snapshot of L1 (owner-global) + L2 (LO-personal)
// connectors. The single helper getConnectorSnapshot() is what the manifest
// + chat tool + UI all read from, so we have one place to evolve the shape.

import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  listLoPersonalConnectors,
  listOwnerGlobalConnectors,
} from "@/lib/mcp/registry";
import type { McpConnectorSnapshot } from "@/lib/mcp/types";

/**
 * Returns the combined connector list for the caller. When `userId` is null
 * (e.g. a manifest call from an unauthenticated route) we still return the
 * L1 owner-global rows — they describe deployment-wide configuration that
 * is safe to surface without a session (status is env-NAME presence, not
 * value). L2 personal rows are scoped via RLS in the server client.
 *
 * Auth token VALUES are never emitted. Only `hasToken: boolean` is set on
 * the returned object, computed server-side.
 */
export async function getConnectorSnapshot(
  userId?: string | null
): Promise<McpConnectorSnapshot> {
  const global = listOwnerGlobalConnectors();
  // Anonymous callers see only the L1 rows. We intentionally don't try to
  // attribute mcp_connections rows without an authenticated session — the
  // RLS check would reject it anyway.
  if (!userId) return global;

  let personal: McpConnectorSnapshot = [];
  try {
    const supabase = getSupabaseServerClient();
    personal = await listLoPersonalConnectors(supabase);
  } catch (e) {
    // Failing to read personal connectors should NEVER block the L1
    // snapshot. Log + degrade gracefully.
    console.error("getConnectorSnapshot personal_read_failed", e);
  }
  return [...global, ...personal];
}

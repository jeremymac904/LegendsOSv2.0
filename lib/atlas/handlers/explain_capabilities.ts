// Capability snapshot — delegates to the legacy `buildCapabilitySnapshot`
// + `renderCapabilityMessage` helpers in toolRouter.ts so the existing rich
// snapshot remains the single source of truth. The runtime wraps it in the
// new card envelope.

import type { CapabilitySnapshotCard } from "@/lib/atlas/cards";
import type {
  AtlasToolContext,
  AtlasToolResult,
  ExplainCapabilitiesInput,
} from "@/lib/atlas/registry";
import {
  buildCapabilitySnapshot,
  renderCapabilityMessage,
} from "@/lib/atlas/toolRouter";

const TOOL_ID = "explain_capabilities";

export async function explainCapabilities(
  _input: ExplainCapabilitiesInput,
  _ctx: AtlasToolContext
): Promise<AtlasToolResult<CapabilitySnapshotCard>> {
  const snap = buildCapabilitySnapshot();
  const message = renderCapabilityMessage(snap);
  const card: CapabilitySnapshotCard = {
    kind: "capability_snapshot",
    tool_id: TOOL_ID,
    title: "Atlas capabilities",
    summary: `${snap.tools.length} tools · ${snap.providers.length} providers tracked`,
    link: "/settings",
    snapshot: snap,
  };
  return { ok: true, card, message };
}

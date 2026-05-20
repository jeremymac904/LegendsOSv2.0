// Synthesize the assistant prose for a tool call.
//
// Atlas tool handlers return both a structured `card` AND a plain-text
// `message`. The chat route writes that message into chat_messages.content so
// MessageRow can render readable prose above the structured chip. If a handler
// ever ships with an empty / whitespace-only message — or if we want a warmer
// kind-aware template for a specific card — this module is the safety net.
//
// The synthesis is PURE: no DB calls, no LLM round-trips. It composes a short
// prose body from the card's own typed fields. That keeps the chat route well
// inside its 10s ceiling and avoids the double-cost of a second provider call.
//
// Honest-action-wording rule: never claim Atlas posted, sent, or published.
// Drafts stay drafts; status / snapshot cards just report what's wired.

import type {
  AssetAttachedCard,
  AssetResultCard,
  AtlasCard,
  CalendarItemCard,
  CapabilitySnapshotCard,
  ChatCard,
  ConnectorStatusCard,
  EmailDraftCard,
  HandoffSummaryCard,
  ImagePromptCard,
  KnowledgeNoteCard,
  KnowledgeResultsCard,
  N8nStatusCard,
  ProviderStatusCard,
  SocialDraftCard,
} from "@/lib/atlas/cards";

// True if `s` is null/undefined or contains only whitespace.
function isBlank(s: string | null | undefined): boolean {
  return !s || s.trim().length === 0;
}

// Build a warm, kind-aware prose body from the card. Used both as the
// guaranteed safety-net body and as a tighter / friendlier rewrite when the
// handler's own message is too terse for the chat surface.
function templateForCard(card: AtlasCard): string {
  switch (card.kind) {
    case "social_draft": {
      const c = card as SocialDraftCard;
      const channels = c.channels.join(", ");
      return [
        `I drafted the social post${c.title ? ` "${c.title}"` : ""} for ${channels} and kept it in draft mode.`,
        "Review it in Social Studio before anything publishes — I won't post live from chat.",
      ].join(" ");
    }
    case "email_draft": {
      const c = card as EmailDraftCard;
      return [
        `I drafted the email "${c.subject}" and kept external sending disabled.`,
        "Open Email Studio to review it before sending — I won't dispatch unless ALLOW_LIVE_EMAIL_SEND is on.",
      ].join(" ");
    }
    case "calendar_item": {
      const c = card as CalendarItemCard;
      let when = "";
      try {
        const d = new Date(c.starts_at);
        if (!isNaN(d.getTime())) {
          when = d.toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          });
        }
      } catch {
        when = "";
      }
      return when
        ? `I added the calendar item — "${c.title}" on ${when}. It's a planning row in LegendsOS only; it's not synced to Google Calendar.`
        : `I added the calendar item "${c.title}". It's a planning row in LegendsOS only; it's not synced to Google Calendar.`;
    }
    case "knowledge_note": {
      const c = card as KnowledgeNoteCard;
      return `I saved that as a knowledge note titled "${c.title}" in your collection. Open Knowledge to edit or move it.`;
    }
    case "knowledge_results": {
      const c = card as KnowledgeResultsCard;
      if (c.hits.length === 0) {
        return "I didn't find anything in your knowledge for that query. Try more specific words, or open Knowledge to browse.";
      }
      const top = c.hits[0];
      return `I found ${c.hits.length} matching knowledge source${c.hits.length === 1 ? "" : "s"}. Top match: "${top.title}".`;
    }
    case "asset_result": {
      const c = card as AssetResultCard;
      if (c.hits.length === 0) {
        return "I didn't find any matching assets in your library. Try a broader query, or open Assets to generate a new one.";
      }
      const topTitle = c.hits[0].title ?? (c.hits[0].prompt ?? "(no prompt)").slice(0, 60);
      return `I found ${c.hits.length} matching asset${c.hits.length === 1 ? "" : "s"}. Top match: "${topTitle}".`;
    }
    case "asset_attached": {
      return "I attached the asset to your draft. It stays a draft — Social Studio is where you publish.";
    }
    case "provider_status": {
      const c = card as ProviderStatusCard;
      const ready = c.providers.filter((p) => p.status === "ready").length;
      return `${ready} of ${c.providers.length} AI provider${c.providers.length === 1 ? "" : "s"} configured and enabled. See Settings → AI Provider Gateway for details.`;
    }
    case "n8n_status": {
      const c = card as N8nStatusCard;
      const ready = c.webhooks.filter((w) => w.present).length;
      const connected = c.configured ? "connected" : "not configured";
      return [
        `n8n hub status: ${connected} (${ready} of ${c.webhooks.length} webhook env vars set).`,
        "Live send / publish stay gated by the owner flags ALLOW_LIVE_EMAIL_SEND and ALLOW_LIVE_SOCIAL_PUBLISH.",
      ].join(" ");
    }
    case "connector_status": {
      const c = card as ConnectorStatusCard;
      const connected = c.connectors.filter((x) => x.status === "connected").length;
      const reserved = c.connectors.filter((x) => x.scope === "future").length;
      return `${connected} of ${c.connectors.length} MCP connectors live${reserved > 0 ? `, ${reserved} reserved for future` : ""}. Open Settings to manage them.`;
    }
    case "image_prompt": {
      const c = card as ImagePromptCard;
      return `Here's the structured prompt (${c.aspect_ratio}). Copy it into Marketing Image Studio when you're ready — live image generation stays off unless you flip ALLOW_LIVE_IMAGE_GEN.`;
    }
    case "handoff_summary": {
      const c = card as HandoffSummaryCard;
      return `Here's the handoff summary you asked for. Next step: ${c.next_step}`;
    }
    case "capability_snapshot": {
      const c = card as CapabilitySnapshotCard;
      // The capability snapshot has its own canonical rendering in the route
      // (renderCapabilityMessage). This template is only used as a fallback if
      // that rendering ever returns an empty string.
      return `Here's a live snapshot of what Atlas can do: ${c.snapshot.tools.length} tools, ${c.snapshot.providers.length} providers tracked.`;
    }
    case "chat": {
      const c = card as ChatCard;
      return c.summary || "Atlas response.";
    }
    default: {
      // Exhaustiveness — if a new card kind is added without updating this
      // file, fall back to the card's own summary string.
      const fallback = (card as { summary?: string }).summary;
      return isBlank(fallback) ? "Atlas finished that action." : (fallback as string);
    }
  }
}

// Public entry: combine the handler's own message (preferred — handlers are
// closer to the data and can include specific ids / file paths) with a typed
// kind-aware safety net. If the handler text is blank, fall through to the
// template. Either way the assistant message is guaranteed to be non-empty.
export function synthesizeAssistantMessage(
  card: AtlasCard,
  handlerMessage: string | null | undefined
): string {
  if (!isBlank(handlerMessage)) {
    return (handlerMessage as string).trim();
  }
  return templateForCard(card);
}

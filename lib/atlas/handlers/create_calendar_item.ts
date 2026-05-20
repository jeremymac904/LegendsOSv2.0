// Insert a calendar_items row. `item_type='team_event'` by default.
// We deep-link to /calendar?month=YYYY-MM&focus=<id> so the calendar grid
// can scroll the new item into view + highlight it.

import type { CalendarItemCard } from "@/lib/atlas/cards";
import type {
  AtlasToolContext,
  AtlasToolResult,
  CreateCalendarItemInput,
} from "@/lib/atlas/registry";

const TOOL_ID = "create_calendar_item";

function isoOrFallback(value: string): string {
  const d = new Date(value);
  if (!isNaN(d.getTime())) return d.toISOString();
  // Caller gave a phrase the planner couldn't normalize — punt to tomorrow 9am.
  const fallback = new Date();
  fallback.setDate(fallback.getDate() + 1);
  fallback.setHours(9, 0, 0, 0);
  return fallback.toISOString();
}

export async function createCalendarItem(
  input: CreateCalendarItemInput,
  ctx: AtlasToolContext
): Promise<AtlasToolResult<CalendarItemCard>> {
  const { profile, supabase } = ctx;
  const { title, starts_at, description, date_phrase } = input;
  const normalizedStart = isoOrFallback(starts_at);

  const { data, error } = await supabase
    .from("calendar_items")
    .insert({
      user_id: profile.id,
      organization_id: profile.organization_id,
      item_type: "team_event",
      title,
      description: description ?? null,
      starts_at: normalizedStart,
      all_day: false,
      metadata: {
        source: "atlas_tool",
        tool_id: TOOL_ID,
        date_phrase: date_phrase ?? null,
      },
    })
    .select("id,title,starts_at")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: "insert_failed",
      message:
        error?.message ??
        "I couldn't save your calendar item. Try again or open Calendar to add it manually.",
    };
  }

  const when = new Date(data.starts_at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const monthSlug = new Date(data.starts_at).toISOString().slice(0, 7);
  const link = `/calendar?month=${monthSlug}&focus=${data.id}`;

  const card: CalendarItemCard = {
    kind: "calendar_item",
    tool_id: TOOL_ID,
    title: data.title,
    summary: `Planned for ${when}.`,
    link,
    item_id: data.id,
    starts_at: data.starts_at,
  };
  const message = `Saved your calendar item "${data.title}" for ${when}. Open it: ${link}`;
  return { ok: true, card, message };
}

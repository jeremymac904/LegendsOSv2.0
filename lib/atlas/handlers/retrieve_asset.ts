// Keyword search across the caller's generated_media rows.
//
// LegendsOS doesn't have a dedicated `assets` table — the closest analog is
// generated_media, which captures every Fal.ai output (prompt + preview URL +
// aspect_ratio). We treat that as the asset library for now. RLS scopes the
// query to the caller, so each LO only sees their own.

import type { AssetResultCard } from "@/lib/atlas/cards";
import type {
  AtlasToolContext,
  AtlasToolResult,
  RetrieveAssetInput,
} from "@/lib/atlas/registry";

const TOOL_ID = "retrieve_asset";

export async function retrieveAsset(
  input: RetrieveAssetInput,
  ctx: AtlasToolContext
): Promise<AtlasToolResult<AssetResultCard>> {
  const { profile, supabase } = ctx;
  const limit = input.limit ?? 5;
  const term = input.query.trim();

  const baseQuery = supabase
    .from("generated_media")
    .select(
      "id,prompt,revised_prompt,preview_url,storage_bucket,storage_path,aspect_ratio,metadata"
    )
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  const { data, error } = term
    ? await baseQuery.or(
        `prompt.ilike.%${term.replace(/[%_]/g, "")}%,revised_prompt.ilike.%${term.replace(/[%_]/g, "")}%`
      )
    : await baseQuery;

  if (error) {
    return {
      ok: false,
      error: "retrieve_failed",
      message:
        error.message ??
        "I couldn't list your assets right now. Try again or open the assets surface in Settings.",
    };
  }

  const hits = (data ?? []).map((row) => {
    const md = (row.metadata ?? {}) as { title?: string };
    return {
      item_id: row.id,
      title: md.title ?? null,
      prompt: row.revised_prompt ?? row.prompt ?? null,
      preview_url: row.preview_url ?? null,
      storage_bucket: row.storage_bucket ?? null,
      storage_path: row.storage_path ?? null,
      aspect_ratio: row.aspect_ratio ?? null,
    };
  });

  const card: AssetResultCard = {
    kind: "asset_result",
    tool_id: TOOL_ID,
    title:
      hits.length > 0
        ? `${hits.length} asset${hits.length === 1 ? "" : "s"} found`
        : "No assets matched",
    summary:
      hits.length > 0
        ? `Most recent: ${hits[0].prompt?.slice(0, 80) ?? "(no prompt)"}`
        : "Nothing matched. Generate a new asset, or refine the query.",
    link: "/admin/assets",
    hits,
  };
  // Warm + specific. We surface the top hit's title (or its prompt slice
  // when there's no title) so the user can confirm Atlas found the asset
  // they expected before opening the library.
  const topTitle =
    hits.length > 0
      ? hits[0].title ?? (hits[0].prompt ?? "(no prompt)").slice(0, 60)
      : null;
  const message =
    hits.length > 0
      ? `I found ${hits.length} matching asset${hits.length === 1 ? "" : "s"}. Top match: "${topTitle}".`
      : `I didn't find any assets matching "${term}". Try a broader query or generate a new one in Marketing Image Studio.`;
  return { ok: true, card, message };
}

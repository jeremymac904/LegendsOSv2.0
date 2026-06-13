import { goatFail, goatOk, withGoat } from "@/lib/goat/api";
import { getGoatClient, goatDbFail, ilikeTerm } from "@/lib/goat/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// search_projects — keyword search over name/description/slug plus exact tag
// match; recent-first listing when no query is given.
export const GET = withGoat("/api/goat/projects/search", async (req, ctx) => {
  const query = (req.nextUrl.searchParams.get("query") ?? "").trim();
  const rawLimit = Number(req.nextUrl.searchParams.get("limit") ?? "10");
  if (Number.isNaN(rawLimit)) {
    return goatFail(ctx, 400, "bad_request", "limit must be a number between 1 and 50.");
  }
  const limit = Math.min(Math.max(Math.trunc(rawLimit), 1), 50);

  const { db, fail } = getGoatClient(ctx);
  if (fail) return fail;

  if (!query) {
    const { data, error } = await db
      .from("goat_projects")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) return goatDbFail(ctx, error);
    return goatOk(ctx, { projects: data, count: data.length, query: null });
  }

  const term = ilikeTerm(query);
  const [byText, byTag] = await Promise.all([
    db
      .from("goat_projects")
      .select("*")
      .or(`name.ilike.${term},description.ilike.${term},slug.ilike.${term}`)
      .order("updated_at", { ascending: false })
      .limit(limit),
    db
      .from("goat_projects")
      .select("*")
      .contains("tags", [query.toLowerCase()])
      .order("updated_at", { ascending: false })
      .limit(limit),
  ]);
  if (byText.error) return goatDbFail(ctx, byText.error);
  if (byTag.error) return goatDbFail(ctx, byTag.error);

  const seen = new Set<string>();
  const projects = [...byText.data, ...byTag.data]
    .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
    .slice(0, limit);

  return goatOk(ctx, { projects, count: projects.length, query });
});

import { goatFail, goatOk, withGoat } from "@/lib/goat/api";
import { getGoatClient, goatDbFail, ilikeTerm } from "@/lib/goat/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// search_memory — keyword search over title/content (plus exact tag match),
// optionally scoped; recent-first listing when no query is given.
export const GET = withGoat("/api/goat/memory/search", async (req, ctx) => {
  const query = (req.nextUrl.searchParams.get("query") ?? "").trim();
  const scope = (req.nextUrl.searchParams.get("scope") ?? "").trim();
  const rawLimit = Number(req.nextUrl.searchParams.get("limit") ?? "10");
  if (Number.isNaN(rawLimit)) {
    return goatFail(ctx, 400, "bad_request", "limit must be a number between 1 and 50.");
  }
  const limit = Math.min(Math.max(Math.trunc(rawLimit), 1), 50);

  const { db, fail } = getGoatClient(ctx);
  if (fail) return fail;

  const base = () => {
    let q = db.from("goat_memories").select("*");
    if (scope) q = q.eq("scope", scope);
    return q;
  };
  type Rows = { data: any[]; error: { message: string; code?: string } | null };
  const finish = (q: ReturnType<typeof base>): PromiseLike<Rows> =>
    q.order("created_at", { ascending: false }).limit(limit) as unknown as PromiseLike<Rows>;

  if (!query) {
    const { data, error } = await finish(base());
    if (error) return goatDbFail(ctx, error);
    return goatOk(ctx, {
      memories: data,
      count: data.length,
      query: null,
      scope: scope || null,
    });
  }

  const term = ilikeTerm(query);
  const [byText, byTag] = await Promise.all([
    finish(base().or(`title.ilike.${term},content.ilike.${term}`)),
    finish(base().contains("tags", [query.toLowerCase()])),
  ]);
  if (byText.error) return goatDbFail(ctx, byText.error);
  if (byTag.error) return goatDbFail(ctx, byTag.error);

  const seen = new Set<string>();
  const memories = [...byText.data, ...byTag.data]
    .filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)))
    .slice(0, limit);

  return goatOk(ctx, { memories, count: memories.length, query, scope: scope || null });
});

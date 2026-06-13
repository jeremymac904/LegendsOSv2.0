import { z } from "zod";

import { goatFail, goatLog, goatOk, readJson, withGoat, zodMessage } from "@/lib/goat/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const searchSchema = z.object({
  query: z.string().min(2).max(200),
  language: z.string().min(1).max(40).optional(),
  sort: z.enum(["best-match", "stars", "updated"]).default("best-match"),
  limit: z.number().int().min(1).max(20).default(5),
});

// research_github — repository search via the public GitHub API. Works
// unauthenticated (low rate limit); set GITHUB_TOKEN for higher limits.
export const POST = withGoat("/api/goat/research/github", async (req, ctx) => {
  const parsed = searchSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return goatFail(ctx, 400, "bad_request", zodMessage(parsed.error.issues));
  }
  const { query, language, sort, limit } = parsed.data;

  const q = language ? `${query} language:${language}` : query;
  const url = new URL("https://api.github.com/search/repositories");
  url.searchParams.set("q", q);
  url.searchParams.set("per_page", String(limit));
  if (sort !== "best-match") url.searchParams.set("sort", sort);

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "goat-architect-command-api",
  };
  const token = process.env.GITHUB_TOKEN || "";
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(url, { headers, cache: "no-store" });
  } catch (err) {
    goatLog("error", ctx, "github_unreachable", {
      message: err instanceof Error ? err.message : String(err),
    });
    return goatFail(ctx, 502, "github_unreachable", "Could not reach the GitHub API.");
  }
  if (res.status === 403 || res.status === 429) {
    return goatFail(
      ctx,
      502,
      "github_rate_limited",
      "GitHub rate limit hit. Set GITHUB_TOKEN on the server for higher limits, or retry in a minute."
    );
  }
  if (!res.ok) {
    return goatFail(ctx, 502, "github_error", `GitHub API returned ${res.status}.`);
  }

  const body = await res.json();
  const results = (body.items ?? []).map((r: any) => ({
    full_name: r.full_name,
    url: r.html_url,
    description: r.description,
    stars: r.stargazers_count,
    language: r.language,
    topics: r.topics ?? [],
    updated_at: r.pushed_at,
  }));
  return goatOk(ctx, { results, total: body.total_count ?? results.length, query: q });
});

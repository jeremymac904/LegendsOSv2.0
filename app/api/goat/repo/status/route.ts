import { goatLog, goatOk, withGoat } from "@/lib/goat/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REPO = process.env.GOAT_GITHUB_REPO || "jeremymac904/LegendsOSv2.0";

// get_repo_status — what is deployed (baked at build time by next.config.mjs)
// plus, when GITHUB_TOKEN is set, the live state of the GitHub repo.
export const GET = withGoat("/api/goat/repo/status", async (_req, ctx) => {
  const deployed = {
    commit: process.env.GOAT_BUILD_COMMIT || "unknown",
    branch: process.env.GOAT_BUILD_BRANCH || "unknown",
    built_at: process.env.GOAT_BUILD_TIME || "unknown",
    deploy_url: process.env.GOAT_PUBLIC_BASE_URL || "https://legendsos.app",
  };

  let live: Record<string, unknown> | null = null;
  const token = process.env.GITHUB_TOKEN || "";
  if (token) {
    try {
      const headers = {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "goat-architect-command-api",
      };
      const [repoRes, commitRes] = await Promise.all([
        fetch(`https://api.github.com/repos/${REPO}`, { headers, cache: "no-store" }),
        fetch(`https://api.github.com/repos/${REPO}/commits?per_page=1`, {
          headers,
          cache: "no-store",
        }),
      ]);
      if (repoRes.ok && commitRes.ok) {
        const repo = await repoRes.json();
        const commits = await commitRes.json();
        const head = Array.isArray(commits) ? commits[0] : null;
        live = {
          default_branch: repo.default_branch,
          pushed_at: repo.pushed_at,
          open_issues: repo.open_issues_count,
          head_commit: head
            ? {
                sha: head.sha,
                message: head.commit?.message?.split("\n")[0] ?? "",
                author: head.commit?.author?.name ?? "",
                date: head.commit?.author?.date ?? "",
              }
            : null,
          in_sync:
            head && deployed.commit !== "unknown" ? head.sha === deployed.commit : null,
        };
      } else {
        goatLog("warn", ctx, "github_status_failed", {
          repo_status: repoRes.status,
          commit_status: commitRes.status,
        });
        live = { error: `GitHub API returned ${repoRes.status}/${commitRes.status}` };
      }
    } catch (err) {
      goatLog("warn", ctx, "github_status_error", {
        message: err instanceof Error ? err.message : String(err),
      });
      live = { error: "GitHub API unreachable" };
    }
  }

  return goatOk(ctx, {
    repository: {
      name: REPO,
      url: `https://github.com/${REPO}`,
    },
    deployed,
    live,
    note: token
      ? undefined
      : "Set GITHUB_TOKEN on the server to include live GitHub repo status.",
  });
});

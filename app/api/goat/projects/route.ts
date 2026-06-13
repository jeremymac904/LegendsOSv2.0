import { z } from "zod";

import { goatFail, goatLog, goatOk, readJson, withGoat, zodMessage } from "@/lib/goat/api";
import { getGoatClient, goatDbFail } from "@/lib/goat/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  repo_url: z.string().url().max(400).optional(),
  status: z.enum(["active", "paused", "done", "idea"]).default("active"),
  tags: z.array(z.string().min(1).max(40)).max(12).default([]),
  metadata: z.record(z.unknown()).default({}),
});

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "project"
  );
}

// create_project
export const POST = withGoat("/api/goat/projects", async (req, ctx) => {
  const parsed = createSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return goatFail(ctx, 400, "bad_request", zodMessage(parsed.error.issues));
  }
  const { db, fail } = getGoatClient(ctx);
  if (fail) return fail;

  const slug = slugify(parsed.data.name);
  const { data, error } = await db
    .from("goat_projects")
    .insert({
      name: parsed.data.name,
      slug,
      description: parsed.data.description ?? null,
      repo_url: parsed.data.repo_url ?? null,
      status: parsed.data.status,
      tags: parsed.data.tags,
      metadata: parsed.data.metadata,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return goatFail(
        ctx,
        409,
        "duplicate_project",
        `A project with slug "${slug}" already exists. Use search_projects to find it or pick a different name.`
      );
    }
    return goatDbFail(ctx, error);
  }
  goatLog("info", ctx, "project_created", { project_id: data.id, slug });
  return goatOk(ctx, { project: data }, { status: 201 });
});

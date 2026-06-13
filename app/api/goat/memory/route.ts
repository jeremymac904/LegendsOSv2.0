import { z } from "zod";

import { goatFail, goatLog, goatOk, readJson, withGoat, zodMessage } from "@/lib/goat/api";
import { getGoatClient, goatDbFail } from "@/lib/goat/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const writeSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(8000),
  scope: z.string().min(1).max(60).default("global"),
  tags: z.array(z.string().min(1).max(40)).max(12).default([]),
});

// write_memory — append-only long-term memory for the GOAT Architect.
export const POST = withGoat("/api/goat/memory", async (req, ctx) => {
  const parsed = writeSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return goatFail(ctx, 400, "bad_request", zodMessage(parsed.error.issues));
  }
  const { db, fail } = getGoatClient(ctx);
  if (fail) return fail;

  const { data, error } = await db
    .from("goat_memories")
    .insert({
      title: parsed.data.title,
      content: parsed.data.content,
      scope: parsed.data.scope,
      tags: parsed.data.tags.map((t) => t.toLowerCase()),
      source: "gpt-action",
    })
    .select()
    .single();
  if (error) return goatDbFail(ctx, error);

  goatLog("info", ctx, "memory_written", { memory_id: data.id, scope: data.scope });
  return goatOk(ctx, { memory: data }, { status: 201 });
});

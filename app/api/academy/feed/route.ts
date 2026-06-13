import { NextResponse } from "next/server";

import { isAdminOrOwner } from "@/lib/permissions";
import { getCurrentProfile, getSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Legends Mortgage Academy team feed. Coach posts (kind=coach/daily/weekly) are
// seeded server-side; members post wins, questions, and scripts. Everything is
// org-scoped via RLS: team members read all feed rows, write their own rows,
// and pin/moderation is reserved for admin/owner.

const POST_COLUMNS =
  "id,organization_id,author_id,author_name,role,category,title,body,pinned,video_embed_url,kind,ref_key,attachment_url,created_at";

const MEMBER_CATEGORIES = ["Wins", "Questions", "Scripts"] as const;
const COACH_CATEGORIES = [...MEMBER_CATEGORIES, "Pinned", "Daily", "Weekly"] as const;

interface PostRow {
  id: string;
  organization_id: string | null;
  author_id: string | null;
  author_name: string | null;
  role: string | null;
  category: string | null;
  title: string | null;
  body: string | null;
  pinned: boolean | null;
  video_embed_url: string | null;
  kind: string | null;
  ref_key: string | null;
  attachment_url: string | null;
  created_at: string;
}

interface CommentRow {
  id: string;
  post_id: string;
  author_id: string | null;
  author_name: string | null;
  body: string | null;
  created_at: string;
}

function displayRole(role: UserRole): string {
  switch (role) {
    case "owner":
    case "admin":
      return "Coach";
    case "processor":
      return "Processor";
    case "coordinator":
      return "Coordinator";
    case "marketing":
      return "Marketing";
    default:
      return "Loan Officer";
  }
}

function serializeComment(row: CommentRow) {
  return {
    id: row.id,
    author: row.author_name ?? "Team Member",
    body: row.body ?? "",
    createdAt: row.created_at,
  };
}

function serializePost(
  row: PostRow,
  profile: Profile,
  comments: CommentRow[],
  likeCount: number,
  likedByMe: boolean,
) {
  return {
    id: row.id,
    kind: row.kind ?? "member",
    refKey: row.ref_key,
    category: row.category ?? "Wins",
    title: row.title ?? "",
    body: row.body ?? "",
    author: row.author_name ?? "Team Member",
    authorId: row.author_id,
    role: row.role ?? "Loan Officer",
    pinned: Boolean(row.pinned),
    embedUrl: row.video_embed_url ?? undefined,
    attachmentUrl: row.attachment_url ?? undefined,
    comments: comments.map(serializeComment),
    likeCount,
    likedByMe,
    createdAt: row.created_at,
    mine: row.author_id === profile.id,
  };
}

export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  const sb = getSupabaseServerClient();

  // Exactly three round trips — posts, comments, likes — joined in JS.
  const [postsRes, commentsRes, likesRes] = await Promise.all([
    sb
      .from("academy_feed_posts")
      .select(POST_COLUMNS)
      .order("created_at", { ascending: false }),
    sb
      .from("academy_feed_comments")
      .select("id,post_id,author_id,author_name,body,created_at")
      .order("created_at", { ascending: true }),
    sb.from("academy_feed_likes").select("post_id,user_id"),
  ]);
  if (postsRes.error) {
    return NextResponse.json({ ok: false, error: postsRes.error.message }, { status: 500 });
  }

  const commentsByPost = new Map<string, CommentRow[]>();
  for (const c of (commentsRes.data ?? []) as CommentRow[]) {
    const list = commentsByPost.get(c.post_id) ?? [];
    list.push(c);
    commentsByPost.set(c.post_id, list);
  }

  const likeCounts = new Map<string, number>();
  const likedByMe = new Set<string>();
  for (const l of (likesRes.data ?? []) as { post_id: string; user_id: string }[]) {
    likeCounts.set(l.post_id, (likeCounts.get(l.post_id) ?? 0) + 1);
    if (l.user_id === profile.id) likedByMe.add(l.post_id);
  }

  const posts = ((postsRes.data ?? []) as PostRow[]).map((row) =>
    serializePost(
      row,
      profile,
      commentsByPost.get(row.id) ?? [],
      likeCounts.get(row.id) ?? 0,
      likedByMe.has(row.id),
    ),
  );

  return NextResponse.json({ ok: true, posts });
}

type FeedAction =
  | {
      action: "post";
      category: string;
      title: string;
      body: string;
      embedUrl?: string;
      attachmentUrl?: string;
    }
  | { action: "comment"; postId: string; body: string }
  | { action: "like"; postId: string }
  | { action: "unlike"; postId: string }
  | { action: "pin"; postId: string; pinned: boolean }
  | { action: "delete"; postId: string };

export async function POST(req: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as FeedAction | null;
  if (!body || typeof body !== "object" || !("action" in body)) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }
  const sb = getSupabaseServerClient();
  const admin = isAdminOrOwner(profile);
  const authorName = profile.full_name?.trim() || profile.email;

  if (body.action === "post") {
    const title = (body.title ?? "").trim();
    const text = (body.body ?? "").trim();
    if (!title && !text) {
      return NextResponse.json({ ok: false, error: "empty_post" }, { status: 400 });
    }
    const allowed: readonly string[] = admin ? COACH_CATEGORIES : MEMBER_CATEGORIES;
    if (!allowed.includes(body.category)) {
      return NextResponse.json({ ok: false, error: "invalid_category" }, { status: 400 });
    }
    const { data, error } = await sb
      .from("academy_feed_posts")
      .insert({
        organization_id: profile.organization_id,
        author_id: profile.id,
        author_name: authorName,
        role: displayRole(profile.role),
        category: body.category,
        title: title || text.split("\n")[0].slice(0, 80),
        body: text,
        pinned: false,
        kind: "member",
        ref_key: null,
        video_embed_url: body.embedUrl?.trim() || null,
        attachment_url: body.attachmentUrl?.trim() || null,
      })
      .select(POST_COLUMNS)
      .single();
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      post: serializePost(data as PostRow, profile, [], 0, false),
    });
  }

  if (body.action === "comment") {
    const text = (body.body ?? "").trim();
    if (!body.postId || !text) {
      return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
    }
    const { data, error } = await sb
      .from("academy_feed_comments")
      .insert({
        post_id: body.postId,
        organization_id: profile.organization_id,
        author_id: profile.id,
        author_name: authorName,
        body: text,
      })
      .select("id,post_id,author_id,author_name,body,created_at")
      .single();
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, comment: serializeComment(data as CommentRow) });
  }

  if (body.action === "like") {
    if (!body.postId) {
      return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
    }
    const { error } = await sb
      .from("academy_feed_likes")
      .upsert(
        {
          post_id: body.postId,
          user_id: profile.id,
          organization_id: profile.organization_id,
        },
        { onConflict: "post_id,user_id", ignoreDuplicates: true },
      );
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "unlike") {
    if (!body.postId) {
      return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
    }
    const { error } = await sb
      .from("academy_feed_likes")
      .delete()
      .eq("post_id", body.postId)
      .eq("user_id", profile.id);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "pin") {
    if (!admin) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
    if (!body.postId || typeof body.pinned !== "boolean") {
      return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
    }
    const { error } = await sb
      .from("academy_feed_posts")
      .update({ pinned: body.pinned })
      .eq("id", body.postId);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "delete") {
    if (!body.postId) {
      return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
    }
    if (!admin) {
      const { data: target } = await sb
        .from("academy_feed_posts")
        .select("id,author_id")
        .eq("id", body.postId)
        .maybeSingle();
      if (!target) {
        return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
      }
      if (target.author_id !== profile.id) {
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      }
    }
    // Best-effort child cleanup first (covers schemas without ON DELETE CASCADE).
    await Promise.all([
      sb.from("academy_feed_comments").delete().eq("post_id", body.postId),
      sb.from("academy_feed_likes").delete().eq("post_id", body.postId),
    ]);
    const { error } = await sb.from("academy_feed_posts").delete().eq("id", body.postId);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
}

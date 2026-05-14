"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarPlus,
  CloudUpload,
  ImageIcon,
  ImagePlus,
  Save,
  Send,
  Sparkles,
  X,
} from "lucide-react";

import { PostPreview, type ChannelId } from "@/components/social/PostPreview";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn, truncate } from "@/lib/utils";
import type { GeneratedMedia, SocialPost } from "@/types/database";

const CHANNELS: { id: ChannelId; label: string }[] = [
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "google_business_profile", label: "Google Business Profile" },
  { id: "youtube", label: "YouTube" },
];

type MediaSummary = Pick<
  GeneratedMedia,
  "id" | "prompt" | "preview_url" | "status" | "created_at" | "provider" | "model"
>;

interface Props {
  userId: string;
  mediaLibrary: MediaSummary[];
  initialSelectedMediaId?: string | null;
  /**
   * When set, the composer opens in EDIT mode against this saved row:
   * every field (title, body, channels, schedule, youtube_title) is
   * hydrated from the row, and Save / Schedule updates the row instead
   * of inserting a new one.
   */
  initialDraft?: SocialPost | null;
  /**
   * Server-computed usage counts. Key = asset id (generated_media UUID,
   * uploaded shared_resources UUID, or manifest slug), value = number of
   * social_posts rows referencing that asset. Used to render the
   * "Used in N posts" chip on each asset in the picker.
   */
  assetUsage?: Record<string, number>;
  /**
   * Atlas-side prefill payload (strict allowlist of fields, decoded
   * server-side). Only fires on initial mount when there's no
   * `initialDraft`. Never trusts URL contents to inject HTML — fields
   * land in React state and are rendered through React's escaping.
   */
  atlasPrefill?: {
    title?: string;
    body?: string;
    channels?: ChannelId[];
  } | null;
}

// Convert a SocialPost.scheduled_at ISO string into the format the native
// <input type="datetime-local"> expects (yyyy-MM-ddTHH:mm). Browser timezone.
function toLocalDateTimeInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function initialMediaIds(args: {
  initialDraft?: SocialPost | null;
  initialSelectedMediaId?: string | null;
}): string[] {
  const { initialDraft, initialSelectedMediaId } = args;
  if (initialDraft) {
    // Saved drafts persist EVERY id in metadata.media_ids; media_id is the
    // first UUID-shaped one. Prefer metadata.media_ids when present so the
    // full attachment list (including non-UUID asset tokens) survives reload.
    const meta = (initialDraft.metadata ?? {}) as { media_ids?: unknown };
    if (Array.isArray(meta.media_ids)) {
      const arr = meta.media_ids.filter(
        (v): v is string => typeof v === "string" && v.length > 0
      );
      if (arr.length > 0) return arr;
    }
    if (initialDraft.media_id) return [initialDraft.media_id];
    return [];
  }
  return initialSelectedMediaId ? [initialSelectedMediaId] : [];
}

export function SocialComposer({
  userId,
  mediaLibrary,
  initialSelectedMediaId,
  initialDraft,
  assetUsage,
  atlasPrefill,
}: Props) {
  const router = useRouter();
  const editing = Boolean(initialDraft?.id);
  const postId = initialDraft?.id ?? null;
  const initialYoutubeTitle =
    (initialDraft?.metadata as { youtube_title?: string } | null)
      ?.youtube_title ?? "";

  // Apply Atlas prefill only on the create-form path (no initialDraft).
  // Atlas-created drafts route to /social/<id> which uses initialDraft.
  const seedTitle =
    initialDraft?.title ?? (!initialDraft ? atlasPrefill?.title ?? "" : "");
  const seedBody =
    initialDraft?.body ?? (!initialDraft ? atlasPrefill?.body ?? "" : "");
  const seedChannels: ChannelId[] =
    initialDraft?.channels && initialDraft.channels.length > 0
      ? (initialDraft.channels as ChannelId[])
      : !initialDraft && atlasPrefill?.channels && atlasPrefill.channels.length > 0
      ? atlasPrefill.channels
      : ["facebook"];

  const [title, setTitle] = useState(seedTitle);
  const [body, setBody] = useState(seedBody);
  const [youtubeTitle, setYoutubeTitle] = useState(initialYoutubeTitle);
  const [selected, setSelected] = useState<ChannelId[]>(seedChannels);
  const [scheduledAt, setScheduledAt] = useState(
    toLocalDateTimeInput(initialDraft?.scheduled_at ?? null)
  );
  const [library, setLibrary] = useState<MediaSummary[]>(mediaLibrary);
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>(
    initialMediaIds({ initialDraft, initialSelectedMediaId })
  );
  const [showLibrary, setShowLibrary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const aiAbortRef = useRef<AbortController | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reseed state if the parent passes in a different draft (e.g. routing
  // between /social and /social/[postId]). Re-running setters from props is
  // safe because the composer is the only thing holding this state.
  useEffect(() => {
    if (!initialDraft) return;
    setTitle(initialDraft.title ?? "");
    setBody(initialDraft.body ?? "");
    setYoutubeTitle(
      (initialDraft.metadata as { youtube_title?: string } | null)
        ?.youtube_title ?? ""
    );
    setSelected(
      initialDraft.channels && initialDraft.channels.length > 0
        ? (initialDraft.channels as ChannelId[])
        : ["facebook"]
    );
    setScheduledAt(toLocalDateTimeInput(initialDraft.scheduled_at ?? null));
    setSelectedMediaIds(initialMediaIds({ initialDraft }));
  }, [initialDraft]);

  useEffect(() => {
    if (initialSelectedMediaId) {
      setSelectedMediaIds((prev) =>
        prev.includes(initialSelectedMediaId) ? prev : [initialSelectedMediaId]
      );
      setInfo("Image preselected from Image Studio. Add your copy and save.");
    }
  }, [initialSelectedMediaId]);

  function toggleChannel(id: ChannelId) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  function toggleMedia(id: string) {
    setSelectedMediaIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }

  async function uploadLocalFile(file: File) {
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
    const path = `${userId}/uploads/${Date.now()}-${safeName}`;
    const { error: upErr } = await supabase.storage
      .from("generated_media")
      .upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (upErr) {
      setError(`Upload failed: ${upErr.message}`);
      return;
    }
    const { data: signed } = await supabase.storage
      .from("generated_media")
      .createSignedUrl(path, 60 * 60 * 24 * 7);
    const previewUrl = signed?.signedUrl ?? null;
    const { data: row, error: insErr } = await supabase
      .from("generated_media")
      .insert({
        user_id: userId,
        prompt: file.name,
        provider: "upload",
        model: null,
        storage_bucket: "generated_media",
        storage_path: path,
        preview_url: previewUrl,
        status: "succeeded",
        metadata: { mime_type: file.type, size_bytes: file.size },
      })
      .select("id,prompt,preview_url,status,created_at,provider,model")
      .single();
    if (insErr || !row) {
      setError(`Save failed: ${insErr?.message ?? "unknown"}`);
      return;
    }
    setLibrary((prev) => [row as MediaSummary, ...prev]);
    setSelectedMediaIds((prev) => [...prev, row.id]);
    setInfo(`Attached upload: ${truncate(file.name, 40)}`);
  }

  // ---------------- AI Write ----------------
  // Mirrors EmailComposer.runAiWrite exactly: defensive Content-Type parse,
  // friendly cap_exceeded / provider_disabled fallback, busy state. Prompts
  // /api/ai/chat for a social caption tailored to whichever channels are
  // currently selected (Facebook gets longer copy, Instagram gets line
  // breaks + hashtags, GBP stays tight, YouTube focuses on the hook).
  async function runAiWrite() {
    if (aiBusy) return;
    setError(null);
    setInfo(null);
    setAiNote(null);
    setAiBusy(true);
    aiAbortRef.current?.abort();
    aiAbortRef.current = new AbortController();
    try {
      const seedTopic = title.trim();
      const channelGuidance: string[] = [];
      if (selected.includes("facebook")) {
        channelGuidance.push(
          "Facebook: 2-3 conversational paragraphs, friendly and helpful."
        );
      }
      if (selected.includes("instagram")) {
        channelGuidance.push(
          "Instagram: short punchy lines separated by line breaks, end with 3-5 relevant hashtags."
        );
      }
      if (selected.includes("google_business_profile")) {
        channelGuidance.push(
          "Google Business Profile: keep it tight — 1-2 sentences, factual, location-aware."
        );
      }
      if (selected.includes("youtube")) {
        channelGuidance.push(
          "YouTube: lead with a strong hook in the first line, then a short description."
        );
      }
      if (channelGuidance.length === 0) {
        channelGuidance.push(
          "Write a friendly general-purpose social caption."
        );
      }
      const prompt = [
        "Draft a social media post for The Legends Mortgage Team.",
        seedTopic
          ? `Topic hint: "${seedTopic}". Stay aligned with that topic.`
          : "Pick a relevant real-estate / mortgage topic the audience would care about.",
        "Channels selected (write ONE caption that fits all of them):",
        channelGuidance.map((g) => `- ${g}`).join("\n"),
        "Do not wrap the response in code fences. No emoji unless an Instagram hashtag block makes sense.",
      ].join("\n\n");

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          thread_id: null,
          assistant_id: null,
          message: prompt,
        }),
        signal: aiAbortRef.current.signal,
      });

      // Defensive parse — same pattern as Atlas / EmailComposer. If
      // middleware bounced us to the login page, the response is HTML.
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) {
        setAiNote(
          res.status === 401
            ? "Your session expired. Refresh the page and try AI Write again."
            : "AI Write received a non JSON response. Please retry in a moment."
        );
        return;
      }
      const data = await res.json();
      if (!data.ok) {
        if (data.error === "cap_exceeded") {
          setAiNote(
            data.message ?? "Daily AI cap reached. Try again tomorrow."
          );
        } else if (data.error === "provider_disabled") {
          setAiNote(
            data.message ?? "AI provider is currently disabled in Settings."
          );
        } else if (data.error === "unauthenticated") {
          setAiNote("Your session expired. Refresh and sign in again.");
        } else {
          setAiNote(`${data.error}: ${data.message}`);
        }
        return;
      }
      const content =
        typeof data.content === "string" ? data.content.trim() : "";
      if (!content) {
        setAiNote("AI returned an empty draft. Try again.");
        return;
      }
      setBody(content);
      // If the internal title is empty, lift the first short line of the
      // generated copy as a working title — keeps the saved-list legible.
      if (!title.trim()) {
        const firstLine = content
          .split("\n")
          .map((s: string) => s.trim())
          .find((s: string) => s.length > 0);
        if (firstLine) setTitle(firstLine.slice(0, 80));
      }
      setAiNote("AI Write applied. Review the body before posting.");
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") return;
      setAiNote(
        e instanceof Error ? `AI Write failed: ${e.message}` : "AI Write failed."
      );
    } finally {
      setAiBusy(false);
    }
  }

  function submit(action: "draft" | "schedule") {
    setError(null);
    setInfo(null);
    if (!body.trim()) {
      setError("Body is required.");
      return;
    }
    if (selected.length === 0) {
      setError("Pick at least one channel.");
      return;
    }
    if (action === "schedule" && !scheduledAt) {
      setError("Pick a schedule time.");
      return;
    }
    if (selected.includes("youtube") && !youtubeTitle.trim()) {
      setError("YouTube needs a video title.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/social", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({
            // When editing, the API UPDATEs the existing row instead of
            // inserting a new draft. Leaving this null keeps the legacy
            // create-new-draft path identical to before.
            post_id: postId,
            title: title || undefined,
            body,
            channels: selected,
            scheduled_at:
              action === "schedule"
                ? new Date(scheduledAt).toISOString()
                : null,
            action,
            media_id: selectedMediaIds[0] ?? null,
            media_ids: selectedMediaIds,
            youtube_title: selected.includes("youtube")
              ? youtubeTitle.trim()
              : null,
          }),
        });

        // Defensive JSON parse — same pattern as Atlas. If middleware bounced
        // us to the login page, the response will be HTML, not JSON.
        const ct = res.headers.get("content-type") ?? "";
        if (!ct.includes("application/json")) {
          setError(
            res.status === 401
              ? "Your session expired. Refresh and sign in again."
              : "Social Studio received a non JSON response. Please refresh."
          );
          return;
        }
        const data = await res.json();
        if (!data.ok) {
          setError(`${data.error}: ${data.message}`);
          return;
        }
        setInfo(
          action === "draft"
            ? editing
              ? "Changes saved."
              : "Draft saved."
            : data.job?.status === "sent"
            ? "Scheduled and dispatched to n8n."
            : `Scheduled. n8n status: ${data.job?.status ?? "queued"}.`
        );
        if (!editing) {
          // Only reset to a blank composer for the legacy create-new-draft
          // path. In edit mode we keep the form populated so the owner can
          // make further tweaks without re-opening the row.
          setTitle("");
          setBody("");
          setYoutubeTitle("");
          setSelected(["facebook"]);
          setScheduledAt("");
          setSelectedMediaIds([]);
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed.");
      }
    });
  }

  const selectedMedia = selectedMediaIds
    .map((id) => library.find((m) => m.id === id))
    .filter((m): m is MediaSummary => Boolean(m));

  const showYouTubeTitleField = selected.includes("youtube");

  return (
    <section className="card-padded space-y-4">
      <div className="section-title">
        <div>
          <h2>Compose</h2>
          <p>Drafts always save. Schedule queues an automation job for later.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={runAiWrite}
            className="btn-ghost text-xs"
            disabled={aiBusy}
            title="Draft this post with AI using the current title hint + selected channels"
          >
            <Sparkles
              size={12}
              className={cn(aiBusy && "animate-pulse text-accent-gold")}
            />
            {aiBusy ? "AI writing…" : "AI Write"}
          </button>
        </div>
      </div>

      {aiNote && (
        <p className="rounded-lg border border-status-info/30 bg-status-info/10 px-3 py-2 text-xs text-status-info">
          {aiNote}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.35fr_1fr]">
        {/* LEFT — form */}
        <div className="space-y-4">

      <input
        className="input"
        placeholder="Internal title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={160}
      />
      <textarea
        className="textarea min-h-[180px]"
        placeholder="What do you want to post? Add the team's NMLS branding line if needed; Atlas can fill it in automatically when you generate copy. Or hit AI Write."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={8000}
      />
      <p className="text-[11px] text-ink-300">
        {body.length.toLocaleString()} chars
      </p>

      {showYouTubeTitleField && (
        <div className="rounded-xl border border-[#FF0000]/30 bg-[#FF0000]/5 p-3">
          <p className="label flex items-center gap-1 text-[#ff8484]">
            YouTube video title{" "}
            <span className="text-[10px] uppercase tracking-[0.18em] text-ink-300">
              (required for YouTube)
            </span>
          </p>
          <input
            className="input mt-2"
            placeholder="e.g. How to qualify for an FHA loan in 2026"
            value={youtubeTitle}
            onChange={(e) => setYoutubeTitle(e.target.value)}
            maxLength={100}
          />
          <p className="mt-1 text-[10px] text-ink-300">
            {youtubeTitle.length}/100 — YouTube limits titles to 100 characters.
          </p>
        </div>
      )}

      <div>
        <p className="label">Media</p>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[auto_1fr]">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn"
              onClick={() => setShowLibrary((v) => !v)}
            >
              <ImagePlus size={14} />
              {showLibrary ? "Hide library" : "Pick from library"}
              {selectedMediaIds.length > 0 && (
                <span className="rounded bg-accent-gold/20 px-1.5 py-0.5 text-[10px] text-accent-gold">
                  {selectedMediaIds.length}
                </span>
              )}
            </button>
            <label className="btn cursor-pointer">
              <CloudUpload size={14} />
              Upload
              <input
                type="file"
                hidden
                accept="image/*,video/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    void uploadLocalFile(f);
                    e.target.value = "";
                  }
                }}
              />
            </label>
          </div>
          {selectedMedia.length > 0 ? (
            <div className="flex flex-wrap gap-2 self-center">
              {selectedMedia.map((m) => (
                <div
                  key={m.id}
                  className="group relative h-16 w-16 overflow-hidden rounded-lg border border-ink-800 bg-checker"
                  title={m.prompt ?? ""}
                >
                  {m.preview_url ? (
                    <img
                      src={m.preview_url}
                      alt={m.prompt ?? ""}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-[9px] text-ink-300">
                      {m.status}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleMedia(m.id)}
                    className="absolute right-0.5 top-0.5 rounded-full bg-ink-950/80 p-0.5 text-ink-100 opacity-0 transition group-hover:opacity-100"
                    aria-label="Remove"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="self-center text-[11px] text-ink-300">
              No media attached yet. Attach generated images or upload your own.
            </p>
          )}
        </div>

        {showLibrary && (
          <div className="mt-3 rounded-xl border border-ink-800 bg-ink-900/40 p-3">
            <p className="text-xs font-medium text-ink-100">Generated library</p>
            {library.length === 0 ? (
              <p className="mt-2 text-[11px] text-ink-300">
                No generated images yet. Open Image Studio to make one.
              </p>
            ) : (
              <div className="mt-2 grid max-h-72 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4 lg:grid-cols-6 scrollbar-thin">
                {library.map((m) => {
                  const picked = selectedMediaIds.includes(m.id);
                  const usedCount = assetUsage?.[m.id] ?? 0;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMedia(m.id)}
                      className={cn(
                        "group relative overflow-hidden rounded-lg border bg-checker transition",
                        picked
                          ? "border-accent-gold/60 ring-2 ring-accent-gold/30"
                          : "border-ink-800 hover:border-ink-600"
                      )}
                      title={
                        usedCount > 0
                          ? `${m.prompt ?? ""} · Used in ${usedCount} post${usedCount === 1 ? "" : "s"}`
                          : m.prompt ?? ""
                      }
                    >
                      {m.preview_url ? (
                        <img
                          src={m.preview_url}
                          alt={m.prompt ?? ""}
                          className="aspect-square w-full object-cover"
                        />
                      ) : (
                        <div className="grid aspect-square place-items-center text-[10px] text-ink-300">
                          <ImageIcon size={14} />
                        </div>
                      )}
                      {picked && (
                        <span className="absolute right-1 top-1 rounded-full bg-accent-gold px-1.5 py-0.5 text-[9px] font-medium text-ink-950">
                          ✓
                        </span>
                      )}
                      {/* Usage chip — accent-gold when used at least once,
                          muted ink-300 when never used. Server-computed by
                          loadSocialAssetUsageCounts to keep this cheap. */}
                      <span
                        className={cn(
                          "absolute bottom-1 left-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium tracking-tight",
                          usedCount > 0
                            ? "border-accent-gold/40 bg-ink-950/80 text-accent-gold"
                            : "border-ink-800 bg-ink-950/70 text-ink-300"
                        )}
                      >
                        {usedCount > 0
                          ? `Used ${usedCount}×`
                          : "Used 0 times"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <p className="label">Channels</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CHANNELS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={cn(
                "rounded-xl border px-3 py-1.5 text-xs transition",
                selected.includes(c.id)
                  ? "border-accent-gold/40 bg-accent-gold/10 text-accent-gold"
                  : "border-ink-700 text-ink-200 hover:border-ink-500"
              )}
              onClick={() => toggleChannel(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <p className="label">Schedule (optional)</p>
          <input
            type="datetime-local"
            className="input mt-2"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </div>
        <div className="self-end text-[11px] text-ink-300">
          Drafts always save. External publishing only runs when the owner
          enables it AND n8n is configured.
        </div>
      </div>
        </div>
        {/* RIGHT — live preview */}
        <PostPreview
          body={body}
          channels={selected}
          media={selectedMedia.map((m) => ({
            id: m.id,
            preview_url: m.preview_url,
            prompt: m.prompt,
          }))}
          youtubeTitle={youtubeTitle}
          scheduledAt={scheduledAt}
          postStatus={scheduledAt ? "scheduled" : "draft"}
        />
      </div>

      {error && (
        <p className="rounded-lg border border-status-err/30 bg-status-err/10 px-3 py-2 text-xs text-status-err">
          {error}
        </p>
      )}
      {info && (
        <p className="rounded-lg border border-status-ok/30 bg-status-ok/10 px-3 py-2 text-xs text-status-ok">
          {info}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          className="btn"
          onClick={() => submit("draft")}
          disabled={isPending || !body.trim()}
        >
          <Save size={14} />
          Save draft
        </button>
        <button
          className="btn-primary"
          onClick={() => submit("schedule")}
          disabled={isPending || !body.trim() || !scheduledAt}
        >
          <CalendarPlus size={14} />
          Schedule
        </button>
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-ink-300">
          <Send size={12} />
          External publishing only fires when the owner enables it.
        </span>
      </div>
    </section>
  );
}

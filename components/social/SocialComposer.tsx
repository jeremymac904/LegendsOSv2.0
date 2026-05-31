"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarPlus,
  Check,
  ClipboardCopy,
  CloudUpload,
  Download,
  ImageIcon,
  ImagePlus,
  Lock,
  PlayCircle,
  Save,
  Send,
  Share2,
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

/**
 * One row in the "Publishing route" section. Computed entirely on the SERVER
 * (page.tsx) from read-only status helpers — this component never inspects env
 * or dispatches anything. `external` routes are always shown as disabled until
 * configured + approved; only the `manual` route does real work (and even then
 * it stays in the browser: copy to clipboard / download a .txt).
 */
export interface PublishingRoute {
  id: "manual" | "zapier" | "n8n" | "heropost";
  label: string;
  detail: string;
  /**
   * Honest current status. `available` is reserved for Manual export. The
   * external routes use the allowed honest labels only — never a fake
   * "connected".
   */
  status: "available" | "key_present" | "setup_needed" | "not_connected";
  statusLabel: string;
  /** External dispatch route — always disabled until configured + approved. */
  external: boolean;
}

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
  /**
   * Publishing-route options + their HONEST current status, computed
   * server-side. Render-only — selecting an external route never dispatches.
   * Defaults to an empty list so the section simply doesn't render if the
   * parent ever omits it.
   */
  publishingRoutes?: PublishingRoute[];
  /** App name, used in the Manual export filename. */
  appName?: string;
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

function mediaLooksLikeVideo(
  media: Pick<MediaSummary, "prompt" | "preview_url">
): boolean {
  const value = `${media.prompt ?? ""} ${media.preview_url ?? ""}`.toLowerCase();
  return (
    value.includes("video/") ||
    /\.(mp4|mov|m4v|webm)(?:$|[?#])/i.test(value)
  );
}

function MediaThumb({
  media,
  className,
}: {
  media: MediaSummary;
  className: string;
}) {
  if (!media.preview_url) return null;
  if (mediaLooksLikeVideo(media)) {
    return (
      <span className={cn("relative block overflow-hidden", className)}>
        <video
          src={media.preview_url}
          className="h-full w-full bg-ink-950 object-cover"
          muted
          playsInline
          preload="metadata"
          title={media.prompt ?? "Attached video"}
        />
        <span className="absolute inset-0 grid place-items-center bg-black/15 text-white/90">
          <PlayCircle size={16} />
        </span>
      </span>
    );
  }
  return (
    <img
      src={media.preview_url}
      alt={media.prompt ?? ""}
      className={className}
    />
  );
}

export function SocialComposer({
  userId,
  mediaLibrary,
  initialSelectedMediaId,
  initialDraft,
  assetUsage,
  atlasPrefill,
  publishingRoutes = [],
  appName = "LegendsOS",
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

  // Publishing-route selection. Defaults to Manual export (the only route that
  // actually works today). Selecting an external route NEVER dispatches — it
  // only reveals the "disabled until configured + approved" explanation.
  const [selectedRoute, setSelectedRoute] = useState<PublishingRoute["id"]>(
    "manual"
  );
  // Transient "copied!" confirmation for the Manual export copy button.
  const [copied, setCopied] = useState(false);

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

  // ---------------- Manual export (REAL, browser-only) ----------------
  // Builds a plain-text bundle of the current draft so the owner can paste it
  // into each platform by hand. Nothing leaves the browser; nothing publishes.
  function buildExportText(): string {
    const channelLabels = selected
      .map((c) => CHANNELS.find((x) => x.id === c)?.label ?? c)
      .join(", ");
    const lines: string[] = [];
    if (title.trim()) lines.push(`Title: ${title.trim()}`);
    if (selected.includes("youtube") && youtubeTitle.trim()) {
      lines.push(`YouTube title: ${youtubeTitle.trim()}`);
    }
    lines.push(`Channels: ${channelLabels || "(none selected)"}`);
    if (scheduledAt) {
      lines.push(`Planned date: ${scheduledAt.replace("T", " ")}`);
    }
    const attached = selectedMediaIds
      .map((id) => library.find((m) => m.id === id)?.preview_url)
      .filter((u): u is string => Boolean(u));
    if (attached.length > 0) {
      lines.push("", "Attached media:");
      attached.forEach((u, i) => lines.push(`  ${i + 1}. ${u}`));
    }
    lines.push("", "---", "", body.trim());
    return lines.join("\n");
  }

  async function copyExport() {
    setError(null);
    setInfo(null);
    if (!body.trim()) {
      setError("Add some body text before exporting.");
      return;
    }
    const text = buildExportText();
    try {
      // navigator.clipboard requires a secure context; fall back to a hidden
      // textarea + execCommand so the manual route works even on http://local.
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      setInfo("Copied the draft to your clipboard. Paste it into each platform.");
    } catch {
      setError("Could not copy. Use Download instead, or copy from the body field.");
    }
  }

  function downloadExport() {
    setError(null);
    setInfo(null);
    if (!body.trim()) {
      setError("Add some body text before exporting.");
      return;
    }
    const text = buildExportText();
    const slug =
      (title.trim() || "social-draft")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40) || "social-draft";
    const appSlug = appName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${appSlug}-${slug}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setInfo("Downloaded the draft as a .txt file.");
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
            : "Saved as a scheduled draft. Nothing was published — external publishing is disabled."
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
          <p>Drafts save to your account. Scheduling stores a date only — nothing is published externally.</p>
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
      <p className="text-[11px] text-ink-600 dark:text-ink-400">
        {body.length.toLocaleString()} chars
      </p>

      {showYouTubeTitleField && (
        <div className="rounded-xl border border-[#FF0000]/30 bg-[#FF0000]/5 p-3">
          <p className="label flex items-center gap-1 text-[#ff8484]">
            YouTube video title{" "}
            <span className="text-[10px] uppercase tracking-[0.18em] text-ink-600 dark:text-ink-400">
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
          <p className="mt-1 text-[10px] text-ink-600 dark:text-ink-400">
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
                    <MediaThumb
                      media={m}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-[9px] text-ink-600 dark:text-ink-300">
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
            <p className="self-center text-[11px] text-ink-600 dark:text-ink-400">
              No media attached yet. Attach generated images or upload your own.
            </p>
          )}
        </div>

        {showLibrary && (
          <div className="mt-3 rounded-xl border border-ink-200 bg-white/70 p-3 dark:border-ink-800 dark:bg-ink-900/40">
            <p className="text-xs font-medium text-ink-900 dark:text-ink-100">Generated library</p>
            {library.length === 0 ? (
              <p className="mt-2 text-[11px] text-ink-600 dark:text-ink-400">
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
                        <MediaThumb
                          media={m}
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
                  : "border-ink-300 text-ink-700 hover:border-ink-400 dark:border-ink-700 dark:text-ink-200 dark:hover:border-ink-500"
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
        <div className="self-end text-[11px] text-ink-600 dark:text-ink-400">
          A schedule time is saved with the draft for your own planning. It does
          not trigger a post.
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

      {publishingRoutes.length > 0 && (
        <PublishingRouteSection
          routes={publishingRoutes}
          selectedRoute={selectedRoute}
          onSelectRoute={setSelectedRoute}
          onCopy={copyExport}
          onDownload={downloadExport}
          copied={copied}
          canExport={Boolean(body.trim())}
        />
      )}

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
          title="Saves the draft with a planned date. Nothing is published externally."
        >
          <CalendarPlus size={14} />
          Save as scheduled draft (external publishing disabled)
        </button>
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-ink-600 dark:text-ink-400">
          <Send size={12} />
          External publishing is disabled. Drafts save to your account only —
          nothing is sent to a social platform.
        </span>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Publishing route section — DRAFT ONLY. Shows the FUTURE routing options and
// their honest current status. Manual export is real and works now; every
// external route is "disabled until configured + approved" and never
// dispatches. This component is pure presentation — it holds no env and makes
// no network calls.
// ---------------------------------------------------------------------------

function routeStatusTone(
  status: PublishingRoute["status"]
): { chip: string; dot: string } {
  switch (status) {
    case "available":
      return { chip: "chip-ok", dot: "bg-status-ok" };
    case "key_present":
      // Key present but unverified — honest "warn", not a green "connected".
      return { chip: "chip-warn", dot: "bg-status-warn" };
    case "setup_needed":
      return { chip: "chip-warn", dot: "bg-status-warn" };
    case "not_connected":
    default:
      return { chip: "chip-off", dot: "bg-status-off" };
  }
}

function PublishingRouteSection({
  routes,
  selectedRoute,
  onSelectRoute,
  onCopy,
  onDownload,
  copied,
  canExport,
}: {
  routes: PublishingRoute[];
  selectedRoute: PublishingRoute["id"];
  onSelectRoute: (id: PublishingRoute["id"]) => void;
  onCopy: () => void;
  onDownload: () => void;
  copied: boolean;
  canExport: boolean;
}) {
  const active = routes.find((r) => r.id === selectedRoute) ?? routes[0];

  return (
    <div className="rounded-xl border border-ink-200 bg-white/70 p-3 dark:border-ink-800 dark:bg-ink-950/40">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg border border-accent-gold/20 bg-accent-gold/10 text-accent-gold">
          <Share2 size={13} />
        </span>
        <div>
          <p className="text-sm font-medium text-ink-900 dark:text-ink-100">
            Publishing route
          </p>
          <p className="text-[11px] text-ink-600 dark:text-ink-400">
            How an approved draft would reach each platform later. Manual export
            works now — external routes stay off until configured and approved.
          </p>
        </div>
      </div>

      {/* Route selector — picking a route only reveals its detail; it never
          dispatches or publishes. */}
      <div className="mt-3 flex flex-wrap gap-2">
        {routes.map((r) => {
          const tone = routeStatusTone(r.status);
          const isActive = r.id === selectedRoute;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onSelectRoute(r.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs transition",
                isActive
                  ? "border-accent-gold/40 bg-accent-gold/10 text-accent-gold"
                  : "border-ink-300 text-ink-700 hover:border-ink-400 dark:border-ink-700 dark:text-ink-200 dark:hover:border-ink-500"
              )}
              aria-pressed={isActive}
            >
              {r.external ? <Lock size={11} /> : <Download size={11} />}
              {r.label}
              <span
                aria-hidden
                className={cn(
                  "inline-block h-1.5 w-1.5 rounded-full",
                  tone.dot
                )}
              />
            </button>
          );
        })}
      </div>

      {active && (
        <div className="mt-3 rounded-lg border border-ink-200 bg-white/60 p-3 dark:border-ink-800 dark:bg-ink-900/40">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-ink-900 dark:text-ink-100">
              {active.label}
            </p>
            <span className={cn(routeStatusTone(active.status).chip)}>
              <span
                aria-hidden
                className={cn(
                  "inline-block h-1.5 w-1.5 rounded-full",
                  routeStatusTone(active.status).dot
                )}
              />
              {active.statusLabel}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-600 dark:text-ink-300">
            {active.detail}
          </p>

          {active.id === "manual" ? (
            // The ONLY route with real actions. Both stay in the browser.
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" className="btn" onClick={onCopy} disabled={!canExport}>
                {copied ? <Check size={14} /> : <ClipboardCopy size={14} />}
                {copied ? "Copied" : "Copy draft"}
              </button>
              <button
                type="button"
                className="btn"
                onClick={onDownload}
                disabled={!canExport}
              >
                <Download size={14} />
                Download .txt
              </button>
              <span className="text-[11px] text-ink-600 dark:text-ink-400">
                Copies title, channels, media links, and body — paste it into
                each platform by hand.
              </span>
            </div>
          ) : (
            // External routes: explicitly disabled, no dispatch control at all.
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn opacity-60"
                disabled
                title="Disabled until configured + approved"
              >
                <Lock size={14} />
                Disabled until configured + approved
              </button>
              <span className="text-[11px] text-ink-600 dark:text-ink-400">
                This route will not publish or dispatch anything. It activates
                only after the owner configures it and approves live publishing.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

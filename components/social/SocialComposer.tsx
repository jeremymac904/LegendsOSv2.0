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
  FileText,
} from "lucide-react";

import { PostPreview, type ChannelId } from "@/components/social/PostPreview";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { SocialPublishGate } from "@/lib/social/destinationReadiness";
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

export interface PublishingRoute {
  id: "manual" | "zapier" | "n8n" | "direct_api";
  label: string;
  detail: string;
  status: "available" | "key_present" | "setup_needed" | "not_connected";
  statusLabel: string;
  external: boolean;
}

interface Props {
  userId: string;
  mediaLibrary: MediaSummary[];
  initialSelectedMediaId?: string | null;
  initialDraft?: SocialPost | null;
  assetUsage?: Record<string, number>;
  atlasPrefill?: {
    title?: string;
    body?: string;
    channels?: ChannelId[];
  } | null;
  destinationGate?: SocialPublishGate | null;
  publishingRoutes?: PublishingRoute[];
  appName?: string;
}

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
    const meta = (initialDraft.metadata ?? {}) as { media_ids?: unknown };
    if (Array.isArray(meta.media_ids)) {
      const arr = meta.media_ids.filter((v): v is string => typeof v === "string" && v.length > 0);
      if (arr.length > 0) return arr;
    }
    if (initialDraft.media_id) return [initialDraft.media_id];
    return [];
  }
  return initialSelectedMediaId ? [initialSelectedMediaId] : [];
}

function MediaThumb({ media, className }: { media: MediaSummary; className: string }) {
  if (!media.preview_url) return null;
  return <img src={media.preview_url} alt={media.prompt ?? ""} className={className} />;
}

export function SocialComposer({
  userId,
  mediaLibrary,
  initialSelectedMediaId,
  initialDraft,
  assetUsage: _assetUsage,
  atlasPrefill,
  destinationGate = null,
  publishingRoutes = [],
  appName = "LegendsOS",
}: Props) {
  const router = useRouter();
  const editing = Boolean(initialDraft?.id);
  const postId = initialDraft?.id ?? null;
  const initialYoutubeTitle = (initialDraft?.metadata as { youtube_title?: string } | null)?.youtube_title ?? "";

  const [title, setTitle] = useState(initialDraft?.title ?? atlasPrefill?.title ?? "");
  const [body, setBody] = useState(initialDraft?.body ?? atlasPrefill?.body ?? "");
  const [youtubeTitle, setYoutubeTitle] = useState(initialYoutubeTitle);
  const [selected, setSelected] = useState<ChannelId[]>(
    initialDraft?.channels && initialDraft.channels.length > 0
      ? (initialDraft.channels as ChannelId[])
      : atlasPrefill?.channels && atlasPrefill.channels.length > 0
      ? atlasPrefill.channels
      : ["facebook"]
  );
  const [scheduledAt, setScheduledAt] = useState(toLocalDateTimeInput(initialDraft?.scheduled_at ?? null));
  const [library, setLibrary] = useState<MediaSummary[]>(mediaLibrary);
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>(initialMediaIds({ initialDraft, initialSelectedMediaId }));
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const aiAbortRef = useRef<AbortController | null>(null);
  const [isPending, startTransition] = useTransition();
  const [selectedRoute, setSelectedRoute] = useState<PublishingRoute["id"]>("zapier");
  const [copied, setCopied] = useState(false);
  const [composerTab, setComposerTab] = useState<"draft" | "media" | "target">("draft");

  useEffect(() => {
    if (initialSelectedMediaId) {
      setSelectedMediaIds((prev) => (prev.includes(initialSelectedMediaId) ? prev : [initialSelectedMediaId]));
      setComposerTab("media");
    }
  }, [initialSelectedMediaId]);

  function toggleChannel(id: ChannelId) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  function toggleMedia(id: string) {
    setSelectedMediaIds((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  }

  async function uploadLocalFile(file: File) {
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
    const path = `${userId}/uploads/${Date.now()}-${safeName}`;
    const { error: upErr } = await supabase.storage.from("generated_media").upload(path, file, { upsert: false });
    if (upErr) { setError(upErr.message); return; }
    const { data: signed } = await supabase.storage.from("generated_media").createSignedUrl(path, 60 * 60 * 24 * 7);
    const previewUrl = signed?.signedUrl ?? null;
    const { data: row } = await supabase.from("generated_media").insert({
      user_id: userId, prompt: file.name, provider: "upload", status: "succeeded",
      storage_bucket: "generated_media", storage_path: path, preview_url: previewUrl,
      metadata: { mime_type: file.type, size_bytes: file.size },
    }).select("id,prompt,preview_url,status,created_at,provider,model").single();
    if (row) { setLibrary((prev) => [row as MediaSummary, ...prev]); setSelectedMediaIds((prev) => [...prev, row.id]); }
  }

  async function runAiWrite() {
    if (aiBusy) return;
    setError(null); setAiNote(null); setAiBusy(true);
    aiAbortRef.current?.abort(); aiAbortRef.current = new AbortController();
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: `Draft a social post about ${title || "mortgages"}` }),
        signal: aiAbortRef.current.signal,
      });
      const data = await res.json();
      if (data.ok) {
        setBody(data.content.trim());
        if (!title.trim()) setTitle(data.content.trim().split("\n")[0].slice(0, 80));
        setAiNote("AI draft applied.");
      }
    } catch { setAiNote("AI Write failed."); } finally { setAiBusy(false); }
  }

  function buildExportText(): string {
    const channelLabels = selected.map((c) => CHANNELS.find((x) => x.id === c)?.label ?? c).join(", ");
    return `Title: ${title}\nChannels: ${channelLabels}\n\n${body}`;
  }

  async function copyExport() {
    const text = buildExportText();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadExport() {
    const text = buildExportText();
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "social-draft.txt"; a.click();
    URL.revokeObjectURL(url);
  }

  function submit(action: "draft" | "schedule") {
    if (!body.trim() || selected.length === 0) { setError("Body and channels required."); return; }
    if (action === "schedule" && destinationGate) {
      const missing = selected.filter((channel) => {
        const gate = destinationGate.channels[channel];
        return !gate?.selected || !gate.publish_enabled;
      });
      if (missing.length > 0) {
        const labels = missing.map((channel) => CHANNELS.find((x) => x.id === channel)?.label ?? channel);
        setError(
          destinationGate.has_any_selected_destination
            ? `Enable publishing for ${labels.join(", ")} in Connection Center before scheduling.`
            : `Select a destination for ${labels.join(", ")} in Connection Center before scheduling.`
        );
        return;
      }
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/social", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            post_id: postId, title, body, channels: selected,
            scheduled_at: action === "schedule" ? new Date(scheduledAt).toISOString() : null,
            action, media_id: selectedMediaIds[0] ?? null, media_ids: selectedMediaIds,
            youtube_title: youtubeTitle.trim() || null,
            publishing_route: selectedRoute,
            publishing_method:
              selectedRoute === "direct_api"
                ? "direct_api"
                : selectedRoute === "manual"
                  ? "manual"
                  : "zapier",
          }),
        });
        const data = await res.json();
        if (data.ok) {
          setInfo(action === "draft" ? "Saved draft." : "Scheduled.");
          if (!editing) { setTitle(""); setBody(""); setYoutubeTitle(""); setSelected(["facebook"]); setScheduledAt(""); setSelectedMediaIds([]); }
          router.refresh();
        } else { setError(data.message); }
      } catch { setError("Submit failed."); }
    });
  }

  const selectedMedia = selectedMediaIds.map((id) => library.find((m) => m.id === id)).filter((m): m is MediaSummary => Boolean(m));
  const scheduleBlocked =
    selectedRoute === "direct_api" &&
    Boolean(destinationGate) &&
    selected.some((channel) => {
      const gate = destinationGate?.channels[channel];
      return !gate?.selected || !gate.publish_enabled;
    });
  const scheduleHelp =
    destinationGate && scheduleBlocked
      ? destinationGate.has_any_selected_destination
        ? "Direct Platform API requires publishing enabled in Connection Center for the selected destination(s)."
        : "Direct Platform API requires a selected destination in Connection Center."
      : null;
  const activeRoute = publishingRoutes.find((route) => route.id === selectedRoute);

  return (
    <section className="card-padded space-y-4">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-1 rounded-xl border border-ink-200 bg-white/60 p-1 dark:border-ink-800 dark:bg-ink-950/40">
             {([
                { id: "draft", label: "Draft", icon: FileText },
                { id: "media", label: "Media", icon: ImageIcon },
                { id: "target", label: "Target", icon: Share2 },
             ] as const).map((t) => {
               const active = composerTab === t.id;
               return (
                 <button key={t.id} onClick={() => setComposerTab(t.id)} className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all", active ? "bg-accent-gold text-ink-950" : "text-ink-600 hover:text-ink-900 dark:hover:text-ink-100")}>
                   <t.icon size={12} /> {t.label}
                 </button>
               );
             })}
          </div>

          <div className="min-h-[400px]">
            {composerTab === "draft" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                   <h3 className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Draft Content</h3>
                   <button type="button" onClick={runAiWrite} className="btn py-1 text-[10px]" disabled={aiBusy}><Sparkles size={12} className={aiBusy ? "animate-pulse text-accent-gold" : ""} /> AI Write</button>
                </div>
                <input className="input" placeholder="Internal Title" value={title} onChange={(e) => setTitle(e.target.value)} />
                <textarea className="textarea min-h-[300px] text-sm" placeholder="Post caption..." value={body} onChange={(e) => setBody(e.target.value)} />
                {aiNote && <p className="text-[10px] text-accent-gold">{aiNote}</p>}
                {selected.includes("youtube") && (
                   <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
                      <p className="label text-[10px] text-red-500 mb-2">YouTube Video Title</p>
                      <input className="input py-1.5 text-xs" value={youtubeTitle} onChange={(e) => setYoutubeTitle(e.target.value)} maxLength={100} />
                   </div>
                )}
              </div>
            )}

            {composerTab === "media" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                   <h3 className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Media Assets</h3>
                   <label className="btn py-1 text-[10px] cursor-pointer"><CloudUpload size={12} /> Upload <input type="file" hidden accept="image/*,video/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadLocalFile(f); }} /></label>
                </div>
                <div className="grid grid-cols-4 gap-2">
                   {library.slice(0, 12).map(m => (
                      <button key={m.id} onClick={() => toggleMedia(m.id)} className={cn("aspect-square overflow-hidden rounded-lg border transition", selectedMediaIds.includes(m.id) ? "border-accent-gold ring-2 ring-accent-gold/20" : "border-ink-200")}>
                         <MediaThumb media={m} className="h-full w-full object-cover" />
                      </button>
                   ))}
                </div>
                {selectedMedia.length > 0 && (
                   <div className="flex flex-wrap gap-2 border-t border-ink-100 dark:border-ink-800 pt-4">
                      {selectedMedia.map(m => (
                         <div key={m.id} className="relative h-12 w-12 rounded border border-ink-200">
                            <MediaThumb media={m} className="h-full w-full object-cover" />
                            <button onClick={() => toggleMedia(m.id)} className="absolute -top-1 -right-1 rounded-full bg-red-500 text-white p-0.5"><X size={10} /></button>
                         </div>
                      ))}
                   </div>
                )}
              </div>
            )}

            {composerTab === "target" && (
              <div className="space-y-6">
                <div>
                   <h3 className="text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-3">Publishing Channels</h3>
                   <div className="flex flex-wrap gap-2">
                      {CHANNELS.map(c => (
                        <button key={c.id} onClick={() => toggleChannel(c.id)} className={cn("rounded-lg border px-3 py-1.5 text-xs transition", selected.includes(c.id) ? "border-accent-gold bg-accent-gold/10 text-accent-gold" : "border-ink-200 text-ink-600 dark:border-ink-800 dark:text-ink-400")}>{c.label}</button>
                      ))}
                   </div>
                </div>
                <div>
                   <h3 className="text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-3">Schedule</h3>
                   <input type="datetime-local" className="input" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
                </div>
                {publishingRoutes.length > 0 && (
                   <div className="border-t border-ink-100 dark:border-ink-800 pt-4">
                      <h3 className="text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-3">Publishing Method</h3>
                      <div className="flex flex-wrap gap-2">
                         {publishingRoutes.map(r => (
                           <button key={r.id} onClick={() => setSelectedRoute(r.id)} className={cn("rounded-lg border px-3 py-1.5 text-[10px]", selectedRoute === r.id ? "border-accent-gold bg-accent-gold/5 text-accent-gold" : "border-ink-200")}>{r.label}</button>
                         ))}
                      </div>
                      {activeRoute && (
                        <p className="mt-2 text-[11px] leading-relaxed text-ink-600 dark:text-ink-300">
                          {activeRoute.detail}
                        </p>
                      )}
                      {selectedRoute === "manual" && (
                         <div className="mt-3 flex gap-2">
                            <button onClick={copyExport} className="btn-ghost py-1 px-3 text-[10px]">{copied ? "Copied!" : "Copy Caption"}</button>
                            <button onClick={downloadExport} className="btn-ghost py-1 px-3 text-[10px]">Download .txt</button>
                         </div>
                      )}
                   </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 min-w-0">
           <h3 className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Live Preview</h3>
           <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin">
              <PostPreview body={body} channels={selected} media={selectedMedia.map(m => ({ id: m.id, preview_url: m.preview_url, prompt: m.prompt }))} youtubeTitle={youtubeTitle} scheduledAt={scheduledAt} postStatus={scheduledAt ? "scheduled" : "draft"} />
           </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-ink-100 dark:border-ink-800 pt-4">
        <div className="flex gap-2">
           <button className="btn text-xs py-1.5" onClick={() => submit("draft")} disabled={isPending || !body.trim()}><Save size={14} /> Save Draft</button>
           <button className="btn-primary text-xs py-1.5" onClick={() => submit("schedule")} disabled={isPending || !body.trim() || !scheduledAt || scheduleBlocked}><CalendarPlus size={14} /> Schedule</button>
        </div>
        {info && <p className="text-xs text-status-ok font-medium">{info}</p>}
        {scheduleHelp && <p className="text-xs text-status-warn font-medium">{scheduleHelp}</p>}
        {error && <p className="text-xs text-status-err font-medium">{error}</p>}
      </div>
    </section>
  );
}

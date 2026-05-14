"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  Mail,
  Paperclip,
  Send,
  Settings as SettingsIcon,
  Share2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn, formatRelative, truncate } from "@/lib/utils";
import type { AtlasAssistant, ChatMessage, ChatThread } from "@/types/database";

type ProviderId = "openrouter" | "deepseek" | "nvidia";

// localStorage keys — keep in sync with deliverable spec so manual page
// reloads remember Jeremy's last provider/model pick.
const LS_PROVIDER_KEY = "legendsos-atlas-provider";
const LS_MODEL_KEY = "legendsos-atlas-model";

interface ProviderEntry {
  id: ProviderId;
  label: string;
  configured: boolean;
  enabled: boolean;
}

interface ModelEntry {
  id: string;
  label: string;
}

export interface AtlasShellProps {
  ownerId: string;
  currentThread?: ChatThread | null;
  initialMessages?: ChatMessage[];
  assistants: AtlasAssistant[];
  providerCatalog: ProviderEntry[];
  modelCatalog: Record<ProviderId, ModelEntry[]>;
  defaultProvider: ProviderId;
}

// Full-width ChatGPT-style chat surface. No top hero, no right column.
// Compose pill is pinned at the bottom of the viewport area (centered, max
// width ~768px). Provider/model/assistant live behind a Settings popover.
export function AtlasShell({
  ownerId,
  currentThread,
  initialMessages = [],
  assistants,
  providerCatalog,
  modelCatalog,
  defaultProvider,
}: AtlasShellProps) {
  const router = useRouter();
  const [threadId, setThreadId] = useState<string | null>(currentThread?.id ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [assistantId, setAssistantId] = useState<string | null>(
    currentThread?.assistant_id ?? null
  );
  const [provider, setProvider] = useState<ProviderId>(defaultProvider);
  const [model, setModel] = useState<string>("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  // Hydrate provider/model from localStorage AFTER mount — keeping the
  // initial render server-equal so React never warns about hydration drift.
  // We only honor the stored provider if it is currently configured + enabled
  // (so a stale "deepseek" pick can't strand the chip on a dead provider).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const storedProvider = window.localStorage.getItem(LS_PROVIDER_KEY);
      const storedModel = window.localStorage.getItem(LS_MODEL_KEY);
      if (
        storedProvider &&
        (storedProvider === "openrouter" ||
          storedProvider === "deepseek" ||
          storedProvider === "nvidia")
      ) {
        const entry = providerCatalog.find((p) => p.id === storedProvider);
        if (entry?.configured && entry.enabled) {
          setProvider(storedProvider as ProviderId);
          if (storedModel) setModel(storedModel);
        }
      }
    } catch {
      // localStorage can throw in private-mode / locked-down browsers.
      // Failing silently is fine — we just stay on the server-supplied
      // default provider.
    }
    // We intentionally only run this once on mount; providerCatalog is a
    // server-prop and won't change inside this render lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist provider/model selection.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(LS_PROVIDER_KEY, provider);
    } catch {}
  }, [provider]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (model) window.localStorage.setItem(LS_MODEL_KEY, model);
    } catch {}
  }, [model]);

  const visibleAssistants = useMemo(
    () =>
      assistants.filter(
        (a) =>
          a.visibility === "team_shared" ||
          a.owner_user_id === ownerId ||
          a.visibility === "owner_only"
      ),
    [assistants, ownerId]
  );

  const providerEntry = providerCatalog.find((p) => p.id === provider);
  const models = useMemo(
    () => modelCatalog?.[provider] ?? [],
    [modelCatalog, provider]
  );

  useEffect(() => {
    if (models.length === 0) {
      setModel("");
      return;
    }
    if (!models.some((m) => m.id === model)) {
      setModel(models[0].id);
    }
  }, [provider, models, model]);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages]);

  // Sync state when navigating to a different thread (initialMessages prop
  // changes because Next streams new server data).
  useEffect(() => {
    setThreadId(currentThread?.id ?? null);
    setMessages(initialMessages);
    setAssistantId(currentThread?.assistant_id ?? null);
  }, [currentThread?.id, currentThread?.assistant_id, initialMessages]);

  function handleAttach(files: FileList | null) {
    if (!files || files.length === 0) return;
    setAttachments((prev) => [...prev, ...Array.from(files)]);
  }

  async function uploadAttachments(currentThreadId: string): Promise<string[]> {
    if (attachments.length === 0) return [];
    const supabase = getSupabaseBrowserClient();
    const uploaded: string[] = [];
    for (const file of attachments) {
      const path = `${ownerId}/atlas/${currentThreadId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("uploads")
        .upload(path, file, { upsert: false });
      if (upErr) {
        setError(`Upload failed: ${upErr.message}`);
        continue;
      }
      const { data: row } = await supabase
        .from("uploaded_files")
        .insert({
          user_id: ownerId,
          bucket: "uploads",
          storage_path: path,
          file_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          source_module: "atlas",
        })
        .select("id")
        .single();
      if (row) uploaded.push(file.name);
    }
    setAttachments([]);
    return uploaded;
  }

  async function send() {
    if (!input.trim() || isPending) return;
    if (providerEntry && !providerEntry.configured) {
      setError(
        `${providerEntry.label} is not configured. Owner: add the matching env var.`
      );
      return;
    }
    if (providerEntry && !providerEntry.enabled) {
      setError(
        `${providerEntry.label} is disabled by the owner (AI_ENABLE_${provider.toUpperCase()}=false).`
      );
      return;
    }
    setError(null);
    const userText = input.trim();
    setInput("");
    const tempUserMsg: ChatMessage = {
      id: `local-${Date.now()}`,
      thread_id: threadId ?? "pending",
      user_id: ownerId,
      role: "user",
      content: userText,
      metadata: {},
      token_count: null,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, tempUserMsg]);
    // Refocus the composer so the user can keep typing immediately.
    composerRef.current?.focus();

    startTransition(async () => {
      try {
        const uploaded = threadId ? await uploadAttachments(threadId) : [];
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({
            thread_id: threadId,
            assistant_id: assistantId,
            provider,
            ...(model ? { model } : {}),
            message:
              uploaded.length > 0
                ? `${userText}\n\n[attached files: ${uploaded.join(", ")}]`
                : userText,
          }),
        });

        // Defensive parsing — if the server returned HTML (a login redirect,
        // a 500 page, a CDN error page), we MUST NOT call `res.json()` on it.
        // That throws "Unexpected token '<'" and confuses Jeremy. Instead,
        // surface a plain English message based on the status code.
        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) {
          if (res.status === 401) {
            setError(
              "Your session expired. Refresh the page and sign in again."
            );
          } else {
            setError(
              "Atlas received a non JSON response. Please refresh and try again."
            );
          }
          return;
        }

        const data = await res.json();
        if (!data.ok) {
          // Friendly mapping for the common cases.
          let friendly = `${data.error}: ${data.message}`;
          if (data.error === "unauthenticated") {
            friendly = "Your session expired. Refresh and sign in again.";
          } else if (data.error === "cap_exceeded") {
            friendly = data.message;
          } else if (data.error === "provider_disabled") {
            friendly = data.message;
          }
          setError(friendly);
          setMessages((m) => [
            ...m,
            {
              ...tempUserMsg,
              id: `local-system-${Date.now()}`,
              role: "system",
              content: `[${data.error}] ${data.message}`,
            },
          ]);
          return;
        }
        const newThreadId = data.thread_id as string;
        if (!threadId) {
          setThreadId(newThreadId);
          router.replace(`/atlas/${newThreadId}`);
        }
        setMessages((m) => [
          ...m,
          {
            id: data.message_id ?? `assistant-${Date.now()}`,
            thread_id: newThreadId,
            user_id: ownerId,
            role: "assistant",
            content: data.content as string,
            metadata: {
              provider: data.provider,
              model: data.model,
              knowledge_hits: data.knowledge?.count ?? 0,
              knowledge_sources: data.knowledge?.sources ?? [],
              // When the chat route fired the Atlas tool router, persist
              // the structured result so MessageRow can render the action
              // chip (icon + summary + Open link).
              ...(data.tool_result ? { tool_result: data.tool_result } : {}),
            },
            token_count: null,
            created_at: new Date().toISOString(),
          },
        ]);
        // Refresh server data so the sidebar threads list picks up the new thread.
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Send failed.");
      }
    });
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // ChatGPT-style: Enter sends, Shift+Enter inserts a newline.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex h-[calc(100vh-3.25rem)] w-full flex-col">
      {/* Branded title strip — gold rune mark + thread title on the left,
          provider/model selector + assistant settings on the right. */}
      <div className="flex items-center justify-between gap-3 border-b border-ink-800 bg-ink-950/70 px-4 py-2 backdrop-blur sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-accent-gold/40 bg-gradient-to-br from-accent-gold/25 via-accent-gold/10 to-accent-orange/10 text-[10px] font-bold tracking-tight text-accent-gold shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15)]"
            title="LegendsOS · Atlas"
          >
            L
          </span>
          <div className="flex min-w-0 items-baseline gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gold-gradient">
              Atlas
            </span>
            <span className="text-ink-700">·</span>
            <p className="truncate text-xs font-medium text-ink-100">
              {currentThread?.title ?? "New conversation"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ProviderModelChip
            provider={provider}
            setProvider={setProvider}
            model={model}
            setModel={setModel}
            providerCatalog={providerCatalog}
            modelCatalog={modelCatalog}
          />
          <AssistantSettingsButton
            assistantId={assistantId}
            setAssistantId={setAssistantId}
            assistants={visibleAssistants}
            open={settingsOpen}
            setOpen={setSettingsOpen}
          />
        </div>
      </div>

      {/* Scrollable conversation */}
      <div
        ref={scrollerRef}
        className="flex-1 overflow-y-auto px-4 py-6 scrollbar-thin"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          {messages.length === 0 && (
            <EmptyChat
              provider={provider}
              configured={Boolean(providerEntry?.configured)}
              onPick={(prompt) => {
                setInput(prompt);
                // Defer focus until after state flushes so the textarea
                // shows the new value before we drop the cursor in it.
                setTimeout(() => composerRef.current?.focus(), 0);
              }}
            />
          )}
          {messages.map((m) => (
            <MessageRow key={m.id} message={m} />
          ))}
          {isPending && (
            <div className="flex items-center gap-2 text-xs text-ink-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-gold" />
              Atlas is thinking…
            </div>
          )}
        </div>
      </div>

      {/* Pinned composer */}
      <div className="border-t border-ink-800 bg-ink-950/80 px-3 pb-4 pt-3 backdrop-blur sm:px-6">
        <div className="mx-auto w-full max-w-3xl">
          {error && (
            <p className="mb-2 rounded-lg border border-status-err/30 bg-status-err/10 px-3 py-2 text-xs text-status-err">
              {error}
            </p>
          )}
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {attachments.map((file, i) => (
                <span key={i} className="chip">
                  {truncate(file.name, 28)}
                  <button
                    type="button"
                    className="text-ink-300 hover:text-status-err"
                    onClick={() =>
                      setAttachments((prev) =>
                        prev.filter((_, idx) => idx !== i)
                      )
                    }
                  >
                    <Trash2 size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-ink-700 bg-ink-900/80 px-2 py-1.5 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.7)] focus-within:border-accent-gold/40">
            <label
              className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl text-ink-300 hover:bg-ink-800 hover:text-ink-100"
              title="Attach file (uploads stored privately under your user folder)"
            >
              <Paperclip size={15} />
              <input
                type="file"
                multiple
                hidden
                onChange={(e) => handleAttach(e.target.files)}
              />
            </label>
            <textarea
              ref={composerRef}
              className="max-h-[40vh] min-h-[40px] flex-1 resize-none bg-transparent px-1 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-400"
              placeholder="Ask Atlas. Enter to send, Shift+Enter for a new line."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={isPending}
              rows={1}
              onInput={(e) => {
                const el = e.target as HTMLTextAreaElement;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
              }}
            />
            <button
              onClick={send}
              className="btn-primary h-9 shrink-0 px-3"
              disabled={isPending || !input.trim()}
              aria-label="Send message"
            >
              <Send size={14} />
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-ink-400">
            via <span className="text-ink-300">{provider}</span>
            {model && (
              <>
                {" · "}
                <span className="text-ink-300">{truncate(model.split("/").slice(-1)[0], 40)}</span>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

const STARTER_PROMPTS = [
  "Write a Facebook post for a first-time homebuyer in Florida.",
  "Draft a 30-second video script explaining FHA vs conventional loans.",
  "Outline a 4-email newsletter sequence for past clients about refinancing.",
  "Explain DTI in plain language for a borrower with a 720 credit score.",
];

function EmptyChat({
  provider,
  configured,
  onPick,
}: {
  provider: ProviderId;
  configured: boolean;
  onPick: (prompt: string) => void;
}) {
  return (
    <div className="grid place-items-center py-16">
      <div className="w-full max-w-xl rounded-2xl border border-ink-800 bg-ink-900/40 p-6">
        <div className="flex flex-col items-center text-center">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-accent-gold via-accent-gold to-accent-orange text-ink-950">
            <Sparkles size={16} />
          </div>
          <h2 className="mt-3 text-base font-semibold text-ink-100">
            Start a conversation
          </h2>
          <p className="mt-1 text-xs text-ink-300">
            Ask Atlas for marketing copy, mortgage explainers, or anything in
            your daily workflow.
          </p>
          {!configured && (
            <p className="mt-3 text-[11px] text-status-warn">
              {provider} is not configured — open Chat settings to switch
              provider.
            </p>
          )}
        </div>
        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {STARTER_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPick(p)}
              className="rounded-xl border border-ink-700 bg-ink-950/50 px-3 py-2 text-left text-[12px] text-ink-200 transition hover:border-accent-gold/40 hover:bg-accent-gold/5 hover:text-ink-100"
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

interface AtlasToolResultMeta {
  kind: "create_social" | "create_email" | "create_calendar";
  itemId: string;
  link: string;
  summary: string;
  // Optional structured title surfaced separately from the long summary so
  // the chip can show "Drafted: <title>" without truncating mid-word.
  title?: string | null;
}

// Extract the short title for display from the structured `title` field when
// present, otherwise fall back to slicing the summary down to its key clause.
// Never returns raw JSON — the source data is plain strings produced by the
// tool router.
function deriveToolTitle(result: AtlasToolResultMeta): string {
  if (result.title && result.title.trim().length > 0) {
    return result.title.trim();
  }
  // The router's summary looks like:
  //   `Social draft "Buying a home" on facebook, instagram`
  //   `Newsletter draft "Refi options"`
  //   `Calendar item "Coffee with Ana" on May 14, 9:00 AM`
  // Pull the quoted segment if present; otherwise return the first 60 chars.
  const quoted = result.summary.match(/"([^"]+)"/);
  if (quoted && quoted[1]) return quoted[1];
  return truncate(result.summary, 60);
}

function ToolResultCard({
  result,
  createdAt,
}: {
  result: AtlasToolResultMeta;
  createdAt: string;
}) {
  const config = {
    create_social: {
      icon: Share2,
      label: "Social draft",
    },
    create_email: {
      icon: Mail,
      label: "Newsletter draft",
    },
    create_calendar: {
      icon: CalendarIcon,
      label: "Calendar item",
    },
  }[result.kind];
  if (!config) return null;
  const Icon = config.icon;
  const title = deriveToolTitle(result);
  // HH:MM in the viewer's locale. Falls back gracefully when the timestamp
  // is malformed so we never crash the chat UI.
  let timeLabel = "";
  try {
    const d = new Date(createdAt);
    if (!isNaN(d.getTime())) {
      timeLabel = d.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      });
    }
  } catch {
    timeLabel = "";
  }
  return (
    <div className="mt-2.5 flex items-center gap-3 rounded-xl border border-accent-gold/30 bg-accent-gold/5 px-3 py-2.5 backdrop-blur-sm">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-accent-gold/30 bg-accent-gold/15 text-accent-gold">
        <Icon size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-gold">
          {config.label}
          {timeLabel ? (
            <span className="ml-1.5 font-normal text-ink-300">
              · Created {timeLabel}
            </span>
          ) : null}
        </p>
        <p className="truncate text-[12px] font-medium text-ink-100">
          {title}
        </p>
      </div>
      <a
        href={result.link}
        className="btn-secondary h-8 shrink-0 px-2.5 text-[11px]"
        aria-label={`Open ${config.label.toLowerCase()}`}
      >
        Open →
      </a>
    </div>
  );
}

function MessageRow({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const meta = (message.metadata ?? {}) as {
    knowledge_hits?: number;
    knowledge_sources?: { title: string; source_path: string | null }[];
    tool_result?: AtlasToolResultMeta;
  };
  const khits = meta.knowledge_hits ?? 0;
  const knowledgeSources = meta.knowledge_sources ?? [];
  const toolResult = meta.tool_result;
  // Show the knowledge pill above the assistant bubble per spec — it reads
  // as a citation badge rather than something stuffed inside the prose.
  const showKnowledgePill = !isUser && !isSystem && khits > 0;
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5",
        isUser ? "items-end" : isSystem ? "items-center" : "items-start"
      )}
    >
      {showKnowledgePill && (
        <span
          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-accent-gold/30 bg-accent-gold/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-accent-gold"
          title={knowledgeSources
            .map((s) => s.title + (s.source_path ? ` (${s.source_path})` : ""))
            .join("\n")}
        >
          <Sparkles size={9} />
          Using {khits} knowledge source{khits === 1 ? "" : "s"}
        </span>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap shadow-sm",
          isUser
            ? "bg-gradient-to-br from-accent-orange/80 to-accent-gold/80 text-ink-950"
            : isSystem
            ? "border border-status-warn/30 bg-status-warn/10 text-status-warn"
            : "border border-ink-800 bg-ink-900/70 text-ink-100"
        )}
      >
        {message.content}
        {!isUser && !isSystem && toolResult && (
          <ToolResultCard
            result={toolResult}
            createdAt={message.created_at}
          />
        )}
        <p
          className={cn(
            "mt-1.5 text-[10px] uppercase tracking-[0.18em]",
            isUser ? "text-ink-950/60" : "text-ink-300"
          )}
        >
          {message.role} · {formatRelative(message.created_at)}
        </p>
      </div>
    </div>
  );
}

// =====================================================================
// Provider + model selector chip
// =====================================================================
//
// Renders as a glass chip top-right of the chat surface. Click opens a
// dropdown listing the configured providers and their curated models.
// Unconfigured providers stay visible but disabled with a "not configured"
// tooltip so Jeremy can SEE that DeepSeek/NVIDIA exist as options, even
// when the env var isn't set yet.
function ProviderModelChip(props: {
  provider: ProviderId;
  setProvider: (p: ProviderId) => void;
  model: string;
  setModel: (m: string) => void;
  providerCatalog: ProviderEntry[];
  modelCatalog: Record<ProviderId, ModelEntry[]>;
}) {
  const { provider, setProvider, model, setModel, providerCatalog, modelCatalog } =
    props;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const providerEntry = providerCatalog.find((p) => p.id === provider);
  const providerLabel = providerEntry?.label ?? provider;
  // Friendly short model name for the chip face. The catalog gives us
  // "default — <full-id>" or "Kimi K2 5 — <full-id>" etc; we just want
  // the trailing segment so the chip stays compact.
  const currentModelEntry = (modelCatalog[provider] ?? []).find(
    (m) => m.id === model
  );
  const modelShort = currentModelEntry
    ? (currentModelEntry.id.split("/").slice(-1)[0] || currentModelEntry.id)
    : "default";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-full border border-ink-700/80 bg-ink-900/70 px-3 text-[11px] font-medium text-ink-100 backdrop-blur-sm transition hover:border-accent-gold/60 hover:text-ink-100",
          open && "border-accent-gold/60 bg-accent-gold/5 text-accent-gold",
          providerEntry && !providerEntry.configured && "text-status-warn"
        )}
        title="Choose provider + model"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            providerEntry?.configured
              ? providerEntry.enabled
                ? "bg-status-ok"
                : "bg-status-off"
              : "bg-status-warn"
          )}
        />
        <span className="truncate">
          {providerLabel}
          <span className="mx-1 text-ink-500">·</span>
          <span className="text-ink-300">{truncate(modelShort, 22)}</span>
        </span>
        <ChevronDown size={11} className="shrink-0 opacity-70" />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-40 mt-1.5 w-80 overflow-hidden rounded-xl border border-ink-700 bg-ink-900/95 shadow-card backdrop-blur"
          role="listbox"
        >
          <div className="flex items-center justify-between gap-2 border-b border-ink-800 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-300">
              Model selector
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-ink-400 transition hover:text-ink-100"
              aria-label="Close model selector"
            >
              <X size={11} />
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto px-1.5 py-2 scrollbar-thin">
            {providerCatalog.map((p) => {
              const models = modelCatalog[p.id] ?? [];
              const isDisabled = !p.configured || !p.enabled;
              return (
                <div key={p.id} className="mb-2 last:mb-0">
                  <p
                    className="flex items-center gap-2 px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400"
                    title={
                      p.configured
                        ? p.enabled
                          ? `${p.label} is configured and enabled`
                          : `${p.label} is disabled by the owner`
                        : `${p.label} is not configured. Owner: set ${p.id.toUpperCase()}_API_KEY.`
                    }
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        p.configured
                          ? p.enabled
                            ? "bg-status-ok"
                            : "bg-status-off"
                          : "bg-status-warn"
                      )}
                    />
                    <span className={cn(isDisabled && "text-ink-500")}>
                      {p.label}
                    </span>
                    {!p.configured && (
                      <span className="ml-auto text-[9px] font-normal tracking-normal text-status-warn">
                        Provider not configured
                      </span>
                    )}
                    {p.configured && !p.enabled && (
                      <span className="ml-auto text-[9px] font-normal tracking-normal text-status-off">
                        Disabled
                      </span>
                    )}
                  </p>
                  {models.length === 0 ? (
                    <button
                      type="button"
                      disabled={isDisabled}
                      onClick={() => {
                        setProvider(p.id);
                        setModel("");
                        setOpen(false);
                      }}
                      title={
                        isDisabled
                          ? "Provider not configured"
                          : "Use provider default model"
                      }
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] transition",
                        isDisabled
                          ? "cursor-not-allowed text-ink-500"
                          : provider === p.id && model === ""
                          ? "bg-accent-gold/10 text-accent-gold"
                          : "text-ink-200 hover:bg-ink-800/70"
                      )}
                    >
                      <span>provider default</span>
                      {provider === p.id && model === "" && !isDisabled && (
                        <Check size={11} className="text-accent-gold" />
                      )}
                    </button>
                  ) : (
                    models.map((m) => {
                      const isSelected = provider === p.id && model === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          disabled={isDisabled}
                          onClick={() => {
                            setProvider(p.id);
                            setModel(m.id);
                            setOpen(false);
                          }}
                          title={
                            isDisabled
                              ? `${p.label} — Provider not configured`
                              : m.label
                          }
                          className={cn(
                            "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] transition",
                            isDisabled
                              ? "cursor-not-allowed text-ink-500"
                              : isSelected
                              ? "bg-accent-gold/10 text-accent-gold"
                              : "text-ink-200 hover:bg-ink-800/70"
                          )}
                        >
                          <span className="truncate">{m.label}</span>
                          {isSelected && !isDisabled && (
                            <Check size={11} className="shrink-0 text-accent-gold" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
          <div className="border-t border-ink-800 px-3 py-1.5 text-[9px] uppercase tracking-[0.18em] text-ink-500">
            Saved locally · changes persist
          </div>
        </div>
      )}
    </div>
  );
}

// Assistant settings popover (split out from the old combined panel so the
// provider/model chip can live in its own affordance). Keeps the gear icon
// for "which assistant profile does Atlas use right now".
function AssistantSettingsButton(props: {
  assistantId: string | null;
  setAssistantId: (id: string | null) => void;
  assistants: AtlasAssistant[];
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const { assistantId, setAssistantId, assistants, open, setOpen } = props;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-full border border-ink-700/80 bg-ink-900/70 text-ink-300 backdrop-blur-sm transition hover:border-accent-gold/60 hover:text-ink-100",
          open && "border-accent-gold/60 text-accent-gold"
        )}
        title="Assistant profile"
        aria-label="Assistant profile"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <SettingsIcon size={12} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1.5 w-72 rounded-xl border border-ink-700 bg-ink-900/95 p-3 shadow-card backdrop-blur">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-ink-100">Assistant</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-ink-300 hover:text-ink-100"
              aria-label="Close"
            >
              <X size={12} />
            </button>
          </div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-ink-300">
            Profile
          </p>
          <select
            className="input mt-1"
            value={assistantId ?? ""}
            onChange={(e) => setAssistantId(e.target.value || null)}
          >
            <option value="">Default Atlas profile</option>
            {assistants.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <p className="mt-2 text-[10px] text-ink-400">
            Pick a profile to attach its knowledge collections.
          </p>
        </div>
      )}
    </div>
  );
}

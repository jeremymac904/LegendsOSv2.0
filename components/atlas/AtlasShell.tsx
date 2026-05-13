"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  Paperclip,
  Send,
  Settings as SettingsIcon,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { StatusPill } from "@/components/ui/StatusPill";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn, formatRelative, truncate } from "@/lib/utils";
import type { AtlasAssistant, ChatMessage, ChatThread } from "@/types/database";

type ProviderId = "openrouter" | "deepseek" | "nvidia";

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
          headers: { "content-type": "application/json" },
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
        const data = await res.json();
        if (!data.ok) {
          setError(`${data.error}: ${data.message}`);
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
            metadata: { provider: data.provider, model: data.model },
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
      {/* Subtle title strip */}
      <div className="flex items-center justify-between gap-3 border-b border-ink-800 bg-ink-950/70 px-4 py-2 backdrop-blur sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles size={13} className="shrink-0 text-accent-gold" />
          <p className="truncate text-xs font-medium text-ink-100">
            {currentThread?.title ?? "New conversation"}
          </p>
        </div>
        <ChatSettingsButton
          provider={provider}
          setProvider={setProvider}
          model={model}
          setModel={setModel}
          providerCatalog={providerCatalog}
          modelCatalog={modelCatalog}
          assistantId={assistantId}
          setAssistantId={setAssistantId}
          assistants={visibleAssistants}
          open={settingsOpen}
          setOpen={setSettingsOpen}
        />
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

function EmptyChat({
  provider,
  configured,
}: {
  provider: ProviderId;
  configured: boolean;
}) {
  return (
    <div className="grid place-items-center py-16">
      <div className="w-full max-w-md rounded-2xl border border-ink-800 bg-ink-900/40 p-6 text-center">
        <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-accent-gold via-accent-gold to-accent-orange text-ink-950">
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
    </div>
  );
}

function MessageRow({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  return (
    <div
      className={cn(
        "flex",
        isUser ? "justify-end" : isSystem ? "justify-center" : "justify-start"
      )}
    >
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

function ChatSettingsButton(props: {
  provider: ProviderId;
  setProvider: (p: ProviderId) => void;
  model: string;
  setModel: (m: string) => void;
  providerCatalog: ProviderEntry[];
  modelCatalog: Record<ProviderId, ModelEntry[]>;
  assistantId: string | null;
  setAssistantId: (id: string | null) => void;
  assistants: AtlasAssistant[];
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const {
    provider,
    setProvider,
    model,
    setModel,
    providerCatalog,
    modelCatalog,
    assistantId,
    setAssistantId,
    assistants,
    open,
    setOpen,
  } = props;
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

  const models = modelCatalog[provider] ?? [];
  const providerEntry = providerCatalog.find((p) => p.id === provider);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-ink-700 bg-ink-900/60 px-2 py-1 text-[11px] text-ink-200 transition hover:border-ink-600",
          open && "border-accent-gold/30 text-accent-gold"
        )}
        title="Chat settings"
      >
        <SettingsIcon size={12} />
        <span>{provider}</span>
        {providerEntry && (
          <StatusPill
            status={
              providerEntry.configured
                ? providerEntry.enabled
                  ? "ok"
                  : "off"
                : "missing"
            }
            label=""
          />
        )}
      </button>
      {open && (
        <PopoverPanel>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-ink-100">Chat settings</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-ink-300 hover:text-ink-100"
              aria-label="Close"
            >
              <X size={12} />
            </button>
          </div>

          <div className="space-y-3">
            <Field label="Provider">
              <div className="grid grid-cols-3 gap-1">
                {providerCatalog.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProvider(p.id)}
                    disabled={!p.configured}
                    className={cn(
                      "rounded-md border px-2 py-1 text-[11px] transition disabled:opacity-40",
                      provider === p.id
                        ? "border-accent-gold/40 bg-accent-gold/10 text-accent-gold"
                        : "border-ink-700 text-ink-200 hover:border-ink-600"
                    )}
                    title={`${p.label} — ${p.configured ? (p.enabled ? "ready" : "off") : "missing"}`}
                  >
                    {p.label.toLowerCase()}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Model">
              {models.length === 0 ? (
                <p className="rounded-md border border-ink-800 bg-ink-900/40 px-2 py-1.5 text-[11px] text-ink-300">
                  No model env vars set. Uses the provider's default.
                </p>
              ) : (
                <select
                  className="input"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <Field label="Assistant">
              <select
                className="input"
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
            </Field>
          </div>
        </PopoverPanel>
      )}
    </div>
  );
}

function PopoverPanel({ children }: { children: ReactNode }) {
  return (
    <div className="absolute right-0 top-full z-40 mt-1 w-72 rounded-xl border border-ink-700 bg-ink-900 p-3 shadow-card">
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-[0.18em] text-ink-300">
        {label}
      </p>
      {children}
    </div>
  );
}

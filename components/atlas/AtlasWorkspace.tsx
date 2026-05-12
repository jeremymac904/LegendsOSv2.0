"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MessageCirclePlus,
  Paperclip,
  Send,
  Settings as SettingsIcon,
  Sparkles,
  Trash2,
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

export interface AtlasWorkspaceProps {
  ownerId: string;
  threads: Pick<ChatThread, "id" | "title" | "last_message_at" | "updated_at" | "assistant_id">[];
  currentThread?: ChatThread | null;
  initialMessages?: ChatMessage[];
  assistants: AtlasAssistant[];
  providerCatalog: ProviderEntry[];
  modelCatalog: Record<ProviderId, ModelEntry[]>;
  defaultProvider: ProviderId;
}

export function AtlasWorkspace({
  ownerId,
  threads,
  currentThread,
  initialMessages = [],
  assistants,
  providerCatalog,
  modelCatalog,
  defaultProvider,
}: AtlasWorkspaceProps) {
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
  const scrollerRef = useRef<HTMLDivElement>(null);

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
            // Only send a model when the user actually picked one. Otherwise
            // let the server fall back to OPENROUTER_DEFAULT_MODEL etc.
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
          // Replace URL so a refresh lands on the thread page.
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
        // Refresh the thread list on the server side so a new thread appears.
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Send failed.");
      }
    });
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      send();
    }
  }

  function providerStatusKind(p: ProviderEntry) {
    if (!p.configured) return "missing" as const;
    if (!p.enabled) return "disabled" as const;
    return "ok" as const;
  }

  function providerStatusLabel(p: ProviderEntry) {
    if (!p.configured) return "missing";
    if (!p.enabled) return "off";
    return "ready";
  }

  return (
    <div className="grid h-[calc(100vh-7rem)] min-h-[640px] grid-cols-1 gap-3 lg:grid-cols-[260px_minmax(0,1fr)_280px]">
      {/* Threads pane */}
      <aside className="card flex h-full flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-ink-800 px-3 py-2">
          <div>
            <p className="text-xs font-semibold text-ink-100">Threads</p>
            <p className="text-[10px] text-ink-300">Your conversations</p>
          </div>
          <Link href="/atlas" className="btn-ghost px-2 py-1 text-[11px]">
            <MessageCirclePlus size={13} />
            New
          </Link>
        </header>
        <div className="flex-1 overflow-y-auto px-2 py-2 scrollbar-thin">
          {threads.length === 0 ? (
            <p className="px-2 py-4 text-xs text-ink-300">
              No threads yet. Send a message to start one.
            </p>
          ) : (
            <ul className="space-y-1">
              {threads.map((t) => {
                const isActive = threadId === t.id;
                return (
                  <li key={t.id}>
                    <Link
                      href={`/atlas/${t.id}`}
                      className={cn(
                        "block rounded-lg border px-2.5 py-2 text-xs transition",
                        isActive
                          ? "border-accent-gold/40 bg-accent-gold/10"
                          : "border-transparent hover:border-ink-700 hover:bg-ink-800/40"
                      )}
                    >
                      <p
                        className={cn(
                          "truncate font-medium",
                          isActive ? "text-accent-gold" : "text-ink-100"
                        )}
                      >
                        {t.title || "Untitled"}
                      </p>
                      <p className="mt-0.5 text-[10px] text-ink-300">
                        {formatRelative(t.last_message_at ?? t.updated_at)}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Chat pane */}
      <section className="card flex h-full flex-col overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-800 bg-ink-900/50 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles size={14} className="shrink-0 text-accent-gold" />
            <p className="truncate text-sm font-medium text-ink-100">
              {currentThread?.title ?? "New conversation"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-300">
            <span className="uppercase tracking-[0.18em]">via</span>
            <span className="rounded bg-ink-800 px-1.5 py-0.5 text-ink-100">
              {provider}
            </span>
            {model && (
              <span className="rounded bg-ink-800 px-1.5 py-0.5 text-ink-100">
                {truncate(model.split("/").slice(-1)[0], 28)}
              </span>
            )}
          </div>
        </header>

        <div
          ref={scrollerRef}
          className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 scrollbar-thin"
        >
          {messages.length === 0 && (
            <div className="grid h-full place-items-center">
              <div className="max-w-sm rounded-2xl border border-ink-800 bg-ink-900/40 p-6 text-center">
                <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-accent-orange to-accent-gold text-ink-950">
                  <Sparkles size={16} />
                </div>
                <h2 className="mt-3 text-base font-semibold text-ink-100">
                  Start a conversation
                </h2>
                <p className="mt-1 text-xs text-ink-300">
                  Ask Atlas for marketing copy, mortgage explainers, or anything
                  in your daily workflow. Provider:{" "}
                  <span className="text-ink-100">{provider}</span>.
                </p>
                <p className="mt-2 text-[11px] text-ink-300">
                  Press <kbd className="rounded border border-ink-700 bg-ink-800 px-1">⌘</kbd>
                  {" "}+ <kbd className="rounded border border-ink-700 bg-ink-800 px-1">↩</kbd>
                  {" "}to send.
                </p>
              </div>
            </div>
          )}
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {isPending && (
            <div className="flex items-center gap-2 text-xs text-ink-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-gold" />
              Atlas is thinking…
            </div>
          )}
        </div>

        <footer className="border-t border-ink-800 bg-ink-900/30 p-3 sm:p-4">
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
                      setAttachments((prev) => prev.filter((_, idx) => idx !== i))
                    }
                  >
                    <Trash2 size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <label
              className="btn-ghost cursor-pointer"
              title="Attach file (uploads stored privately under your user folder)"
            >
              <Paperclip size={14} />
              <input
                type="file"
                multiple
                hidden
                onChange={(e) => handleAttach(e.target.files)}
              />
            </label>
            <textarea
              className="textarea flex-1 min-h-[88px]"
              placeholder="Ask Atlas. ⌘+Enter to send."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={isPending}
            />
            <button
              onClick={send}
              className="btn-primary self-stretch"
              disabled={isPending || !input.trim()}
            >
              <Send size={14} />
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>
        </footer>
      </section>

      {/* Options pane */}
      <aside className="card flex h-full flex-col gap-3 overflow-y-auto p-3 scrollbar-thin">
        <div>
          <p className="label flex items-center gap-1">
            <SettingsIcon size={11} />
            Provider
          </p>
          <div className="mt-2 grid grid-cols-3 gap-1">
            {providerCatalog.map((p) => (
              <button
                key={p.id}
                onClick={() => setProvider(p.id)}
                disabled={!p.configured}
                className={cn(
                  "rounded-lg border px-2 py-1.5 text-xs transition disabled:opacity-50",
                  provider === p.id
                    ? "border-accent-gold/40 bg-accent-gold/10 text-accent-gold"
                    : "border-ink-700 text-ink-200 hover:border-ink-600"
                )}
                title={`${p.label} — ${providerStatusLabel(p)}`}
              >
                {p.label.toLowerCase()}
              </button>
            ))}
          </div>
          <div className="mt-2 space-y-1 text-[11px]">
            {providerCatalog.map((p) => (
              <div key={p.id} className="flex items-center justify-between">
                <span className="text-ink-200">{p.label}</span>
                <StatusPill
                  status={providerStatusKind(p)}
                  label={providerStatusLabel(p)}
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="label">Model</p>
          {models.length === 0 ? (
            <p className="mt-2 rounded-lg border border-ink-800 bg-ink-900/40 px-2 py-2 text-[11px] text-ink-300">
              No model env vars set for this provider. Atlas will use the
              provider's configured default.
            </p>
          ) : (
            <select
              className="input mt-2"
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
        </div>

        <div>
          <p className="label">Assistant</p>
          <select
            className="input mt-2"
            value={assistantId ?? ""}
            onChange={(e) => setAssistantId(e.target.value || null)}
          >
            <option value="">Default Atlas profile</option>
            {visibleAssistants.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-ink-300">
            You only see assistants assigned to you or marked team-shared.
          </p>
        </div>

        <div>
          <p className="label">Session</p>
          <ul className="mt-2 space-y-1 text-[11px]">
            <li className="flex items-center justify-between">
              <span className="text-ink-200">Usage logging</span>
              <StatusPill status="ok" label="on" />
            </li>
            <li className="flex items-center justify-between">
              <span className="text-ink-200">Branding line</span>
              <StatusPill status="info" label="auto" />
            </li>
            <li className="flex items-center justify-between">
              <span className="text-ink-200">Attachments</span>
              <StatusPill status="ok" label="on" />
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
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
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
          isUser
            ? "bg-gradient-to-br from-accent-orange/80 to-accent-gold/80 text-ink-950"
            : isSystem
            ? "border border-status-warn/30 bg-status-warn/10 text-status-warn"
            : "border border-ink-800 bg-ink-900/80 text-ink-100"
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
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

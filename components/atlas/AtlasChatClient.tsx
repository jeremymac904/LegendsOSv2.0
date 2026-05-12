"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Send, Sparkles, Trash2 } from "lucide-react";

import { StatusPill } from "@/components/ui/StatusPill";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn, formatRelative, truncate } from "@/lib/utils";
import type { AtlasAssistant, ChatMessage } from "@/types/database";

interface AtlasChatClientProps {
  initialThreadId: string | null;
  initialMessages?: ChatMessage[];
  assistants: AtlasAssistant[];
  ownerId: string;
  initialAssistantId?: string | null;
}

export function AtlasChatClient({
  initialThreadId,
  initialMessages = [],
  assistants,
  ownerId,
  initialAssistantId,
}: AtlasChatClientProps) {
  const router = useRouter();
  const [threadId, setThreadId] = useState<string | null>(initialThreadId);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [assistantId, setAssistantId] = useState<string | null>(
    initialAssistantId ?? assistants[0]?.id ?? null
  );
  const [provider, setProvider] = useState<"openrouter" | "deepseek" | "nvidia">(
    "openrouter"
  );
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

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleAttach(files: FileList | null) {
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

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_240px]">
      <div className="card flex h-[640px] flex-col">
        <div className="flex items-center justify-between border-b border-ink-800 px-4 py-2 text-xs text-ink-300">
          <div className="flex items-center gap-2">
            <Sparkles size={12} className="text-accent-gold" />
            <span>
              {assistantId
                ? visibleAssistants.find((a) => a.id === assistantId)?.name ?? "Atlas"
                : "Default Atlas profile"}
            </span>
          </div>
          <span className="text-[10px] uppercase tracking-[0.18em] text-ink-400">
            Provider · {provider}
          </span>
        </div>
        <div
          ref={scrollerRef}
          className="flex-1 space-y-3 overflow-y-auto p-4 scrollbar-thin"
        >
          {messages.length === 0 && (
            <div className="grid h-full place-items-center text-center text-sm text-ink-300">
              <div>
                <p className="text-ink-100">Start a conversation</p>
                <p className="mt-1 text-xs">
                  Ask anything. Files attach via the paperclip and are stored
                  privately. Press <kbd>⌘</kbd>+<kbd>↩︎</kbd> to send.
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
        <div className="border-t border-ink-800 p-3">
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
            <label className="btn-ghost cursor-pointer" title="Attach file">
              <Paperclip size={14} />
              <input
                type="file"
                multiple
                hidden
                onChange={(e) => handleAttach(e.target.files)}
              />
            </label>
            <textarea
              className="textarea flex-1 min-h-[72px]"
              placeholder="Ask Atlas. Press ⌘+Enter to send."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={isPending}
            />
            <button
              onClick={send}
              className="btn-primary"
              disabled={isPending || !input.trim()}
            >
              <Send size={14} />
              Send
            </button>
          </div>
        </div>
      </div>

      <aside className="space-y-3">
        <div className="card-padded">
          <p className="label">Assistant</p>
          <select
            className="input mt-2"
            value={assistantId ?? ""}
            onChange={(e) => setAssistantId(e.target.value || null)}
          >
            <option value="">Default Atlas</option>
            {visibleAssistants.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <p className="mt-2 text-[11px] text-ink-300">
            You only see assistants assigned to you or marked team-shared.
          </p>
        </div>
        <div className="card-padded">
          <p className="label">Provider</p>
          <div className="mt-2 grid grid-cols-3 gap-1">
            {(["openrouter", "deepseek", "nvidia"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setProvider(p)}
                className={cn(
                  "rounded-lg border px-2 py-1 text-xs",
                  provider === p
                    ? "border-accent-gold/40 bg-accent-gold/10 text-accent-gold"
                    : "border-ink-700 text-ink-300 hover:border-ink-600"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className="card-padded">
          <p className="label">Safety</p>
          <div className="mt-2 space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span>Live text gen</span>
              <StatusPill status="warn" label="needs ALLOW flag" />
            </div>
            <div className="flex items-center justify-between">
              <span>Usage logging</span>
              <StatusPill status="ok" label="on" />
            </div>
            <div className="flex items-center justify-between">
              <span>Compliance line</span>
              <StatusPill status="info" label="auto" />
            </div>
          </div>
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
          "max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm",
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
            "mt-1 text-[10px] uppercase tracking-[0.18em]",
            isUser ? "text-ink-950/60" : "text-ink-300"
          )}
        >
          {message.role} · {formatRelative(message.created_at)}
        </p>
      </div>
    </div>
  );
}

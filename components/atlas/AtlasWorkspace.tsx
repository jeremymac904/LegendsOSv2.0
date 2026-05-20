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
  BookOpen,
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Info,
  Mail,
  PanelLeft,
  PanelRight,
  Paperclip,
  Send,
  Share2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn, formatRelative, truncate } from "@/lib/utils";
import type { AtlasAssistant, ChatMessage, ChatThread } from "@/types/database";

import { ConnectorPanel } from "./ConnectorPanel";
import { LOWorkspace } from "./LOWorkspace";

// ─── Types ──────────────────────────────────────────────────────────────────

type ProviderId = "openrouter" | "deepseek" | "nvidia";

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

export interface AtlasWorkspaceProps {
  ownerId: string;
  currentThread?: ChatThread | null;
  initialMessages?: ChatMessage[];
  assistants: AtlasAssistant[];
  providerCatalog: ProviderEntry[];
  modelCatalog: Record<ProviderId, ModelEntry[]>;
  defaultProvider: ProviderId;
}

// ─── Tool result card ────────────────────────────────────────────────────────

interface AtlasToolResultMeta {
  kind:
    | "create_social"
    | "create_email"
    | "create_calendar"
    | "explain_capabilities"
    | "create_knowledge_note";
  itemId: string;
  link: string;
  summary: string;
  title?: string | null;
  capabilities?: {
    providers: {
      id: string;
      label: string;
      status: "ready" | "configured" | "disabled" | "missing";
      env_var: string;
      next_action: string | null;
    }[];
  };
}

function deriveToolTitle(result: AtlasToolResultMeta): string {
  if (result.title?.trim()) return result.title.trim();
  const quoted = result.summary.match(/"([^"]+)"/);
  if (quoted?.[1]) return quoted[1];
  return truncate(result.summary, 60);
}

function ToolResultCard({ result, createdAt }: { result: AtlasToolResultMeta; createdAt: string }) {
  const config: Record<string, { icon: React.ComponentType<{ size?: number | string; className?: string }>; label: string; openLabel: string }> = {
    create_social:         { icon: Share2,      label: "Social draft",      openLabel: "Open" },
    create_email:          { icon: Mail,        label: "Newsletter draft",   openLabel: "Open" },
    create_calendar:       { icon: CalendarIcon,label: "Calendar item",     openLabel: "Open" },
    explain_capabilities:  { icon: Info,        label: "Atlas capabilities", openLabel: "Settings" },
    create_knowledge_note: { icon: BookOpen,    label: "Knowledge note",    openLabel: "Open" },
  };
  const entry = config[result.kind];
  if (!entry) return null;
  const Icon = entry.icon;
  const title = deriveToolTitle(result);
  const providerDots = result.kind === "explain_capabilities" ? result.capabilities?.providers?.slice(0, 5) ?? [] : [];
  let timeLabel = "";
  try {
    const d = new Date(createdAt);
    if (!isNaN(d.getTime())) timeLabel = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {}
  return (
    <div className="mt-2.5 flex items-center gap-3 rounded-xl border border-accent-gold/30 bg-accent-gold/5 px-3 py-2.5 backdrop-blur-sm">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-accent-gold/30 bg-accent-gold/15 text-accent-gold">
        <Icon size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-gold">
          {entry.label}
          {timeLabel && <span className="ml-1.5 font-normal text-ink-300">· {result.kind === "explain_capabilities" ? "Snapshot" : "Created"} {timeLabel}</span>}
        </p>
        <p className="truncate text-[12px] font-medium text-ink-100">{title}</p>
        {providerDots.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {providerDots.map((p) => (
              <span key={p.id} title={p.next_action ?? `${p.label} is ${p.status}`} className="inline-flex items-center gap-1 rounded-full border border-ink-700/80 bg-ink-900/60 px-1.5 py-[1px] text-[9.5px] uppercase tracking-[0.14em] text-ink-300">
                <span className={cn("h-1.5 w-1.5 rounded-full", p.status === "ready" ? "bg-status-ok" : p.status === "disabled" ? "bg-status-off" : "bg-status-warn")} />
                {p.label}
              </span>
            ))}
          </div>
        )}
      </div>
      <a href={result.link} className="btn-secondary h-8 shrink-0 px-2.5 text-[11px]">{entry.openLabel} →</a>
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
  const ksources = meta.knowledge_sources ?? [];
  const toolResult = meta.tool_result;
  return (
    <div className={cn("flex flex-col gap-1.5", isUser ? "items-end" : isSystem ? "items-center" : "items-start")}>
      {!isUser && !isSystem && khits > 0 && (
        <div className="flex max-w-full flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-gold/30 bg-accent-gold/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-accent-gold">
            <Sparkles size={9} />{khits} source{khits === 1 ? "" : "s"}
          </span>
          {ksources.slice(0, 3).map((s, i) => (
            <span key={`${i}-${s.title}`} className="inline-flex max-w-[18rem] items-center gap-1 truncate rounded-full border border-ink-700/70 bg-ink-900/70 px-2 py-0.5 text-[10px] text-ink-200">
              <span aria-hidden className="text-accent-gold/70">·</span>
              <span className="truncate">{s.source_path ? `${s.title} · ${s.source_path.split("/").slice(-2).join("/")}` : s.title}</span>
            </span>
          ))}
          {ksources.length > 3 && <span className="inline-flex items-center rounded-full border border-ink-700/70 bg-ink-900/70 px-2 py-0.5 text-[10px] text-ink-300">+{ksources.length - 3} more</span>}
        </div>
      )}
      <div className={cn(
        "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap shadow-sm",
        isUser ? "bg-gradient-to-br from-accent-orange/80 to-accent-gold/80 text-ink-950"
          : isSystem ? "border border-status-warn/30 bg-status-warn/10 text-status-warn"
          : "border border-ink-800 bg-ink-900/70 text-ink-100"
      )}>
        {message.content}
        {!isUser && !isSystem && toolResult && <ToolResultCard result={toolResult} createdAt={message.created_at} />}
        <p className={cn("mt-1.5 text-[10px] uppercase tracking-[0.18em]", isUser ? "text-ink-950/60" : "text-ink-300")}>
          {message.role} · {formatRelative(message.created_at)}
        </p>
      </div>
    </div>
  );
}

// ─── EmptyChat ───────────────────────────────────────────────────────────────

const STARTER_PROMPTS = [
  "What can you do?",
  "Draft a Facebook post about FHA loans for first-time homebuyers.",
  "Write a newsletter about refinancing for past clients.",
  "Schedule a team standup on Monday.",
];

function EmptyChat({ provider, configured, onPick }: {
  provider: string; configured: boolean; onPick: (p: string) => void;
}) {
  return (
    <div className="grid place-items-center py-12">
      <div className="w-full max-w-xl rounded-2xl border border-ink-800 bg-ink-900/40 p-6">
        <div className="flex flex-col items-center text-center">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-accent-gold via-accent-gold to-accent-orange text-ink-950">
            <Sparkles size={16} />
          </div>
          <h2 className="mt-3 text-base font-semibold text-ink-100">Start a conversation</h2>
          <p className="mt-1 text-xs text-ink-300">Ask Atlas for marketing copy, mortgage explainers, or anything in your daily workflow.</p>
          {!configured && <p className="mt-3 text-[11px] text-status-warn">{provider} is not configured — open Chat settings to switch provider.</p>}
        </div>
        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {STARTER_PROMPTS.map((p) => (
            <button key={p} type="button" onClick={() => onPick(p)}
              className="rounded-xl border border-ink-700 bg-ink-950/50 px-3 py-2 text-left text-[12px] text-ink-200 transition hover:border-accent-gold/40 hover:bg-accent-gold/5 hover:text-ink-100">
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── ProviderModelChip ───────────────────────────────────────────────────────

function ProviderModelChip(props: {
  provider: ProviderId; setProvider: (p: ProviderId) => void;
  model: string; setModel: (m: string) => void;
  providerCatalog: ProviderEntry[]; modelCatalog: Record<ProviderId, ModelEntry[]>;
}) {
  const { provider, setProvider, model, setModel, providerCatalog, modelCatalog } = props;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) { if (!ref.current?.contains(e.target as Node)) setOpen(false); }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); document.removeEventListener("keydown", onKey); };
  }, [open]);
  const providerEntry = providerCatalog.find((p) => p.id === provider);
  const currentModelEntry = (modelCatalog[provider] ?? []).find((m) => m.id === model);
  const modelShort = currentModelEntry ? (currentModelEntry.id.split("/").slice(-1)[0] || currentModelEntry.id) : "default";
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)}
        className={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-full border border-ink-700/80 bg-ink-900/70 px-3 text-[11px] font-medium text-ink-100 backdrop-blur-sm transition hover:border-accent-gold/60",
          open && "border-accent-gold/60 bg-accent-gold/5 text-accent-gold",
          providerEntry && !providerEntry.configured && "text-status-warn"
        )}>
        <span className={cn("h-1.5 w-1.5 rounded-full",
          providerEntry?.configured ? providerEntry.enabled ? "bg-status-ok" : "bg-status-off" : "bg-status-warn"
        )} />
        <span className="truncate">{providerEntry?.label ?? provider}<span className="mx-1 text-ink-500">·</span><span className="text-ink-300">{truncate(modelShort, 20)}</span></span>
        <ChevronDown size={11} className="shrink-0 opacity-70" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1.5 w-72 overflow-hidden rounded-xl border border-ink-700 bg-ink-900/95 shadow-card backdrop-blur">
          <div className="flex items-center justify-between gap-2 border-b border-ink-800 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-300">Model selector</p>
            <button type="button" onClick={() => setOpen(false)} className="text-ink-400 hover:text-ink-100"><X size={11} /></button>
          </div>
          <div className="max-h-72 overflow-y-auto px-1.5 py-2 scrollbar-thin">
            {providerCatalog.map((p) => {
              const pModels = modelCatalog[p.id] ?? [];
              const isDisabled = !p.configured || !p.enabled;
              return (
                <div key={p.id} className="mb-2 last:mb-0">
                  <p className={cn("flex items-center gap-2 px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.18em]", isDisabled ? "text-ink-500" : "text-ink-400")}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", p.configured ? p.enabled ? "bg-status-ok" : "bg-status-off" : "bg-status-warn")} />
                    {p.label}
                    {!p.configured && <span className="ml-auto text-[9px] font-normal text-status-warn">Not configured</span>}
                  </p>
                  <button type="button" disabled={isDisabled}
                    onClick={() => { setProvider(p.id); setModel(pModels[0]?.id ?? ""); setOpen(false); }}
                    className={cn("flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] transition",
                      isDisabled ? "cursor-not-allowed text-ink-500" : provider === p.id ? "bg-accent-gold/10 text-accent-gold" : "text-ink-200 hover:bg-ink-800/70"
                    )}>
                    <span>{pModels[0]?.label ?? "provider default"}</span>
                    {provider === p.id && !isDisabled && <Check size={11} className="text-accent-gold" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AtlasWorkspace (main export) ────────────────────────────────────────────

export function AtlasWorkspace({
  ownerId, currentThread, initialMessages = [],
  assistants: _assistants, providerCatalog, modelCatalog, defaultProvider,
}: AtlasWorkspaceProps) {
  const router = useRouter();
  const [threadId, setThreadId] = useState<string | null>(currentThread?.id ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [provider, setProvider] = useState<ProviderId>(defaultProvider);
  const [model, setModel] = useState<string>("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const sp = window.localStorage.getItem(LS_PROVIDER_KEY) as ProviderId | null;
      const sm = window.localStorage.getItem(LS_MODEL_KEY);
      if (sp && ["openrouter","deepseek","nvidia"].includes(sp)) {
        const entry = providerCatalog.find((p) => p.id === sp);
        if (entry?.configured && entry.enabled) { setProvider(sp); if (sm) setModel(sm); }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { try { window.localStorage.setItem(LS_PROVIDER_KEY, provider); } catch {} }, [provider]);
  useEffect(() => { try { if (model) window.localStorage.setItem(LS_MODEL_KEY, model); } catch {} }, [model]);

  const models = useMemo(() => modelCatalog?.[provider] ?? [], [modelCatalog, provider]);
  useEffect(() => {
    if (models.length === 0) { setModel(""); return; }
    if (!models.some((m) => m.id === model)) setModel(models[0].id);
  }, [provider, models, model]);

  useEffect(() => { if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight; }, [messages]);
  useEffect(() => { setThreadId(currentThread?.id ?? null); setMessages(initialMessages); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [currentThread?.id]);

  const providerEntry = providerCatalog.find((p) => p.id === provider);

  function injectPrompt(prompt: string) { setInput(prompt); setTimeout(() => composerRef.current?.focus(), 0); }

  function handleAttach(files: FileList | null) {
    if (!files || files.length === 0) return;
    setAttachments((prev) => [...prev, ...Array.from(files)]);
  }

  async function uploadAttachments(ctid: string): Promise<string[]> {
    if (attachments.length === 0) return [];
    const supabase = getSupabaseBrowserClient();
    const uploaded: string[] = [];
    for (const file of attachments) {
      const path = `${ownerId}/atlas/${ctid}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("uploads").upload(path, file, { upsert: false });
      if (upErr) { setError(`Upload failed: ${upErr.message}`); continue; }
      const { data: row } = await supabase.from("uploaded_files").insert({
        user_id: ownerId, bucket: "uploads", storage_path: path,
        file_name: file.name, mime_type: file.type, size_bytes: file.size, source_module: "atlas",
      }).select("id").single();
      if (row) uploaded.push(file.name);
    }
    setAttachments([]);
    return uploaded;
  }

  async function send() {
    if (!input.trim() || isPending) return;
    if (providerEntry && !providerEntry.configured) { setError(`${providerEntry.label} is not configured.`); return; }
    setError(null);
    const userText = input.trim();
    setInput("");
    const tempMsg: ChatMessage = { id: `local-${Date.now()}`, thread_id: threadId ?? "pending", user_id: ownerId, role: "user", content: userText, metadata: {}, token_count: null, created_at: new Date().toISOString() };
    setMessages((m) => [...m, tempMsg]);
    composerRef.current?.focus();
    startTransition(async () => {
      try {
        const uploaded = threadId ? await uploadAttachments(threadId) : [];
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ thread_id: threadId, provider, ...(model ? { model } : {}), message: uploaded.length > 0 ? `${userText}\n\n[attached files: ${uploaded.join(", ")}]` : userText }),
        });
        const ct = res.headers.get("content-type") ?? "";
        if (!ct.includes("application/json")) { setError(res.status === 401 ? "Your session expired." : "Atlas received a non-JSON response."); return; }
        const data = await res.json();
        if (!data.ok) {
          let msg = `${data.error}: ${data.message}`;
          if (data.error === "unauthenticated") msg = "Your session expired. Refresh and sign in again.";
          else if (data.error === "cap_exceeded" || data.error === "provider_disabled") msg = data.message;
          setError(msg);
          setMessages((m) => [...m, { ...tempMsg, id: `local-sys-${Date.now()}`, role: "system", content: `[${data.error}] ${data.message}` }]);
          return;
        }
        const newTid = data.thread_id as string;
        if (!threadId) { setThreadId(newTid); router.replace(`/atlas/${newTid}`); }
        setMessages((m) => [...m, { id: data.message_id ?? `asst-${Date.now()}`, thread_id: newTid, user_id: ownerId, role: "assistant", content: data.content, metadata: { provider: data.provider, model: data.model, knowledge_hits: data.knowledge?.count ?? 0, knowledge_sources: data.knowledge?.sources ?? [], ...(data.tool_result ? { tool_result: data.tool_result } : {}) }, token_count: null, created_at: new Date().toISOString() }]);
        router.refresh();
      } catch (e) { setError(e instanceof Error ? e.message : "Send failed."); }
    });
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }

  return (
    <div className="flex h-[calc(100vh-3.25rem)] w-full overflow-hidden">
      {/* Left: Connector Panel */}
      <div className={cn("flex flex-col border-r border-ink-800 bg-ink-950/60 backdrop-blur transition-all duration-200", leftOpen ? "w-52 shrink-0" : "w-0 overflow-hidden")}>
        <div className="flex items-center justify-between gap-2 border-b border-ink-800 px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-gradient">Atlas</span>
          <button type="button" onClick={() => setLeftOpen(false)} className="text-ink-500 hover:text-ink-200"><ChevronsLeft size={12} /></button>
        </div>
        <ConnectorPanel />
      </div>
      {!leftOpen && (
        <button type="button" onClick={() => setLeftOpen(true)} title="Open connector panel"
          className="flex w-7 shrink-0 flex-col items-center justify-center gap-1 border-r border-ink-800 bg-ink-950/60 text-ink-500 transition hover:bg-ink-900/60 hover:text-ink-200">
          <PanelLeft size={13} />
        </button>
      )}

      {/* Center: Chat */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-ink-800 bg-ink-950/70 px-4 py-2 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-accent-gold/40 bg-gradient-to-br from-accent-gold/25 via-accent-gold/10 to-accent-orange/10 text-[10px] font-bold tracking-tight text-accent-gold" title="LegendsOS · Atlas">L</span>
            <div className="flex min-w-0 items-baseline gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gold-gradient">Atlas</span>
              <span className="text-ink-700">·</span>
              <p className="truncate text-xs font-medium text-ink-100">{currentThread?.title ?? "New conversation"}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ProviderModelChip provider={provider} setProvider={setProvider} model={model} setModel={setModel} providerCatalog={providerCatalog} modelCatalog={modelCatalog} />
            <button type="button" onClick={() => setRightOpen((o) => !o)} title={rightOpen ? "Close LO workspace" : "Open LO workspace"}
              className={cn("grid h-7 w-7 place-items-center rounded-full border border-ink-700/80 bg-ink-900/70 text-ink-300 backdrop-blur-sm transition hover:border-accent-gold/60 hover:text-accent-gold", rightOpen && "border-accent-gold/40 text-accent-gold")}>
              <PanelRight size={13} />
            </button>
          </div>
        </div>
        <div ref={scrollerRef} className="flex-1 overflow-y-auto px-4 py-6 scrollbar-thin">
          <div className="mx-auto flex max-w-3xl flex-col gap-5">
            {messages.length === 0 && <EmptyChat provider={provider} configured={Boolean(providerEntry?.configured)} onPick={injectPrompt} />}
            {messages.map((m) => <MessageRow key={m.id} message={m} />)}
            {isPending && <div className="flex items-center gap-2 text-xs text-ink-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-gold" />Atlas is thinking…</div>}
          </div>
        </div>
        <div className="border-t border-ink-800 bg-ink-950/80 px-3 pb-4 pt-3 backdrop-blur sm:px-6">
          <div className="mx-auto w-full max-w-3xl">
            {error && <p className="mb-2 rounded-lg border border-status-err/30 bg-status-err/10 px-3 py-2 text-xs text-status-err">{error}</p>}
            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1">
                {attachments.map((file, i) => (
                  <span key={i} className="chip">{truncate(file.name, 28)}<button type="button" className="text-ink-300 hover:text-status-err" onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}><Trash2 size={10} /></button></span>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2 rounded-2xl border border-ink-700 bg-ink-900/80 px-2 py-1.5 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.7)] focus-within:border-accent-gold/40">
              <label className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl text-ink-300 hover:bg-ink-800 hover:text-ink-100" title="Attach file">
                <Paperclip size={15} />
                <input type="file" multiple hidden onChange={(e) => handleAttach(e.target.files)} />
              </label>
              <textarea ref={composerRef} className="max-h-[40vh] min-h-[40px] flex-1 resize-none bg-transparent px-1 py-2 text-sm text-ink-100 outline-none placeholder:text-ink-400" placeholder="Ask Atlas. Enter to send, Shift+Enter for a new line." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKey} disabled={isPending} rows={1}
                onInput={(e) => { const el = e.target as HTMLTextAreaElement; el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 320)}px`; }} />
              <button onClick={send} className="btn-primary h-9 shrink-0 px-3" disabled={isPending || !input.trim()} aria-label="Send message"><Send size={14} /><span className="hidden sm:inline">Send</span></button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-ink-400">via <span className="text-ink-300">{provider}</span>{model && <> · <span className="text-ink-300">{truncate(model.split("/").slice(-1)[0], 40)}</span></>}</p>
          </div>
        </div>
      </div>

      {/* Right: LO Workspace */}
      <div className={cn("flex flex-col border-l border-ink-800 bg-ink-950/60 backdrop-blur transition-all duration-200", rightOpen ? "w-56 shrink-0" : "w-0 overflow-hidden")}>
        <div className="flex items-center justify-between gap-2 border-b border-ink-800 px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-300">LO Workspace</span>
          <button type="button" onClick={() => setRightOpen(false)} className="text-ink-500 hover:text-ink-200"><ChevronsRight size={12} /></button>
        </div>
        <LOWorkspace onPrompt={injectPrompt} />
      </div>
    </div>
  );
}

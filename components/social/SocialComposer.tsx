"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Save, Send } from "lucide-react";

import { cn } from "@/lib/utils";

const CHANNELS = [
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "google_business_profile", label: "Google Business Profile" },
  { id: "youtube", label: "YouTube" },
] as const;

export function SocialComposer() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selected, setSelected] = useState<string[]>(["facebook"]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleChannel(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
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
    startTransition(async () => {
      try {
        const res = await fetch("/api/social", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: title || undefined,
            body,
            channels: selected,
            scheduled_at: action === "schedule" ? new Date(scheduledAt).toISOString() : null,
            action,
          }),
        });
        const data = await res.json();
        if (!data.ok) {
          setError(`${data.error}: ${data.message}`);
          return;
        }
        setInfo(
          action === "draft"
            ? "Draft saved."
            : data.job?.status === "sent"
            ? "Scheduled and dispatched to n8n."
            : `Scheduled. n8n status: ${data.job?.status ?? "queued"}.`
        );
        setTitle("");
        setBody("");
        setSelected(["facebook"]);
        setScheduledAt("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed.");
      }
    });
  }

  return (
    <section className="card-padded space-y-3">
      <div className="section-title">
        <div>
          <h2>Compose</h2>
          <p>Drafts save instantly. Scheduling queues an automation job.</p>
        </div>
      </div>
      <input
        className="input"
        placeholder="Internal title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={160}
      />
      <textarea
        className="textarea min-h-[180px]"
        placeholder="What do you want to post? Compliance line is added by Atlas if you use the auto-fill assistant."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={8000}
      />
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
          Live publishing is gated by{" "}
          <code>ALLOW_LIVE_SOCIAL_PUBLISH</code> and a configured n8n webhook.
        </div>
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
          No post is published without an explicit confirmation gate.
        </span>
      </div>
    </section>
  );
}

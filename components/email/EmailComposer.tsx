"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Mail, Save, Send } from "lucide-react";

export function EmailComposer() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [body, setBody] = useState("");
  const [recipients, setRecipients] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(action: "draft" | "approve" | "request_send") {
    setError(null);
    setInfo(null);
    if (!subject.trim()) {
      setError("Subject is required.");
      return;
    }
    if (action !== "draft" && !body.trim()) {
      setError("Body is required to approve or request send.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/email", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            subject,
            preview_text: previewText || undefined,
            body_text: body,
            recipient_list: recipients || undefined,
            action,
          }),
        });
        const data = await res.json();
        if (!data.ok) {
          setError(`${data.error}: ${data.message}`);
          return;
        }
        if (action === "draft") setInfo("Draft saved.");
        if (action === "approve") setInfo("Approved.");
        if (action === "request_send") {
          setInfo(
            data.job?.status === "sent"
              ? "Send requested and dispatched to n8n."
              : `Send queued. n8n status: ${data.job?.status ?? "queued"}.`
          );
        }
        if (action !== "draft") router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed.");
      }
    });
  }

  return (
    <section className="card-padded space-y-3">
      <div className="section-title">
        <div>
          <h2>Compose newsletter</h2>
          <p>Drafts save instantly. External sending only runs when the owner enables it.</p>
        </div>
      </div>
      <input
        className="input"
        placeholder="Subject line"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        maxLength={300}
      />
      <input
        className="input"
        placeholder="Preview text (optional)"
        value={previewText}
        onChange={(e) => setPreviewText(e.target.value)}
        maxLength={200}
      />
      <input
        className="input"
        placeholder="Recipient list key (e.g. all-leads)"
        value={recipients}
        onChange={(e) => setRecipients(e.target.value)}
        maxLength={120}
      />
      <textarea
        className="textarea min-h-[260px]"
        placeholder="Body text. Compose plaintext for now; HTML rendering is coming next pass."
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
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
        <button className="btn" onClick={() => submit("draft")} disabled={isPending}>
          <Save size={14} />
          Save draft
        </button>
        <button
          className="btn"
          onClick={() => submit("approve")}
          disabled={isPending || !body.trim()}
        >
          <CheckCircle size={14} />
          Mark ready
        </button>
        <button
          className="btn-primary"
          onClick={() => submit("request_send")}
          disabled={isPending || !body.trim()}
        >
          <Send size={14} />
          Queue send
        </button>
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-ink-300">
          <Mail size={12} />
          External sending is owner-controlled.
        </span>
      </div>
    </section>
  );
}

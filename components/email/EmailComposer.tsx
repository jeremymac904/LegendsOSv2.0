"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle,
  Eye,
  EyeOff,
  Mail,
  Save,
  Send,
  UserCheck,
  Users2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { EmailCampaign } from "@/types/database";

export interface AudienceOption {
  id: string;
  name: string;
  total: number;
  active: number;
}

interface Props {
  initialDraft?: EmailCampaign | null;
  liveSendEnabled?: boolean;
  audiences?: AudienceOption[];
  ownerEmail?: string;
  ownerName?: string;
}

export function EmailComposer({
  initialDraft,
  liveSendEnabled,
  audiences = [],
  ownerEmail = "",
  ownerName = "",
}: Props) {
  const router = useRouter();
  const [campaignId, setCampaignId] = useState<string | null>(
    initialDraft?.id ?? null
  );
  const [subject, setSubject] = useState(initialDraft?.subject ?? "");
  const [previewText, setPreviewText] = useState(
    initialDraft?.preview_text ?? ""
  );
  const [body, setBody] = useState(initialDraft?.body_text ?? "");
  const [recipients, setRecipients] = useState(
    initialDraft?.recipient_list ?? ""
  );
  const [showPreview, setShowPreview] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setCampaignId(initialDraft?.id ?? null);
    setSubject(initialDraft?.subject ?? "");
    setPreviewText(initialDraft?.preview_text ?? "");
    setBody(initialDraft?.body_text ?? "");
    setRecipients(initialDraft?.recipient_list ?? "");
  }, [initialDraft]);

  const previewHtml = useMemo(() => renderMarkdownPreview(body), [body]);

  function submit(action: "draft" | "approve" | "request_send" | "request_test") {
    setError(null);
    setInfo(null);
    if (!subject.trim()) {
      setError("Subject is required.");
      return;
    }
    if (action !== "draft" && !body.trim()) {
      setError("Body is required to mark ready or queue a send.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/email", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            campaign_id: campaignId,
            subject,
            preview_text: previewText || undefined,
            body_text: body,
            body_html: previewHtml,
            recipient_list: recipients || undefined,
            action,
          }),
        });
        const data = await res.json();
        if (!data.ok) {
          setError(`${data.error}: ${data.message}`);
          return;
        }
        if (data.campaign?.id) setCampaignId(data.campaign.id);
        if (action === "draft") setInfo("Draft saved.");
        if (action === "approve") setInfo("Marked ready.");
        if (action === "request_send") {
          setInfo(
            data.job?.status === "sent"
              ? "Send queued and dispatched to n8n."
              : `Send queued. n8n status: ${data.job?.status ?? "queued"}.`
          );
        }
        if (action === "request_test") {
          setInfo(
            data.job?.status === "sent"
              ? `Test sent to ${data.test_recipient ?? "owner inbox"}.`
              : `Test prepared for ${data.test_recipient ?? "owner inbox"}. n8n status: ${data.job?.status ?? "queued"} — no audience emails went out.`
          );
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed.");
      }
    });
  }

  // Active audience summary (drives the big "X active contacts" card).
  const selectedAudienceId = recipients.startsWith("audience:")
    ? recipients.slice("audience:".length)
    : null;
  const selectedAudience = selectedAudienceId
    ? audiences.find((a) => a.id === selectedAudienceId)
    : null;

  return (
    <section className="card-padded space-y-3">
      <div className="section-title">
        <div>
          <h2>{campaignId ? "Edit campaign" : "Compose newsletter"}</h2>
          <p>Drafts save instantly. External sending only runs when the owner enables it.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className="btn-ghost text-xs"
          title={showPreview ? "Hide preview" : "Show preview"}
        >
          {showPreview ? <EyeOff size={12} /> : <Eye size={12} />}
          {showPreview ? "Hide preview" : "Show preview"}
        </button>
      </div>

      <div
        className={cn(
          "grid gap-3",
          showPreview ? "lg:grid-cols-2" : "grid-cols-1"
        )}
      >
        <div className="space-y-2">
          <input
            className="input"
            placeholder="Subject line"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={300}
          />
          <input
            className="input"
            placeholder="Preview text (optional, shown in inbox preview)"
            value={previewText}
            onChange={(e) => setPreviewText(e.target.value)}
            maxLength={200}
          />
          <div className="space-y-2">
            {audiences.length > 0 ? (
              <select
                className="input"
                value={
                  recipients.startsWith("audience:") ? recipients : ""
                }
                onChange={(e) => setRecipients(e.target.value)}
                aria-label="Recipient audience"
              >
                <option value="">— Select an audience —</option>
                {audiences.map((a) => (
                  <option key={a.id} value={`audience:${a.id}`}>
                    {a.name} · {a.active.toLocaleString()} active
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="input"
                placeholder="Recipient list (e.g. all-leads) — import a CSV under Audiences to switch to a list picker"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                maxLength={120}
              />
            )}
            {audiences.length === 0 && (
              <p className="text-[10px] text-ink-300">
                No audiences yet. Open Audiences (top-right) to import a CSV.
              </p>
            )}
            {selectedAudience && (
              <div className="flex items-start gap-3 rounded-xl border border-accent-gold/30 bg-accent-gold/5 p-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-gold/20 text-accent-gold">
                  <Users2 size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-100">
                    {selectedAudience.name}
                  </p>
                  <p className="mt-0.5 text-[12px] text-ink-200">
                    <span className="font-semibold text-accent-gold">
                      {selectedAudience.active.toLocaleString()}
                    </span>{" "}
                    active contact
                    {selectedAudience.active === 1 ? "" : "s"} ·{" "}
                    {selectedAudience.total.toLocaleString()} total
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-ink-300">
                    Blast size when you Queue send
                  </p>
                </div>
              </div>
            )}
            {!selectedAudience && audiences.length > 0 && (
              <p className="text-[10px] text-ink-300">
                Pick an audience above to see the blast size before sending.
              </p>
            )}
          </div>
          <textarea
            className="textarea min-h-[260px] font-mono text-[13px]"
            placeholder={`Markdown supported. Examples:

# Heading
**Bold** and *italic*
- bullet 1
- bullet 2

[Link](https://example.com)`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        {showPreview && (
          <div className="space-y-2">
            <div className="rounded-xl border border-ink-800 bg-ink-900/40 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-ink-300">
                Inbox preview
              </p>
              <p className="mt-1 font-medium text-ink-100">
                {subject || "Subject preview"}
              </p>
              <p className="text-xs text-ink-300">
                {previewText || "Preview text appears here"}
              </p>
            </div>
            <div className="rounded-xl border border-ink-800 bg-ink-900/30 p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-ink-300">
                Rendered body
              </p>
              <div
                className="prose prose-invert mt-2 max-w-none text-sm text-ink-100 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-accent-gold [&_a]:underline"
                dangerouslySetInnerHTML={{
                  __html:
                    previewHtml ||
                    '<p class="text-ink-300">Start typing in the editor on the left…</p>',
                }}
              />
            </div>
          </div>
        )}
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
          className="btn"
          onClick={() => submit("request_test")}
          disabled={isPending || !body.trim() || !ownerEmail}
          title={
            ownerEmail
              ? `Routes only to ${ownerEmail}${ownerName ? ` (${ownerName})` : ""}, never to the selected audience.`
              : "Owner email not configured."
          }
        >
          <UserCheck size={14} />
          {ownerEmail ? `Queue test to ${ownerName || "me"}` : "Queue test"}
        </button>
        <button
          className="btn-primary"
          onClick={() => submit("request_send")}
          disabled={isPending || !body.trim()}
          title={
            liveSendEnabled
              ? "Queue a send through n8n"
              : "External sending is owner-controlled. Will be queued only."
          }
        >
          <Send size={14} />
          {selectedAudience
            ? `Queue send · ${selectedAudience.active.toLocaleString()} contacts`
            : "Queue send"}
        </button>
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-ink-300">
          <Mail size={12} />
          {liveSendEnabled
            ? "External sending enabled — n8n must be configured."
            : "External sending disabled — drafts queue without dispatch."}
        </span>
      </div>
    </section>
  );
}

// Small Markdown subset → HTML for the preview pane. Headings, bold/italic,
// bullet + numbered lists, http(s)/mailto links, paragraphs.
function renderMarkdownPreview(src: string): string {
  if (!src) return "";
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let html = escape(src);
  html = html.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code}</code></pre>`);
  html = html.replace(/^###### (.+)$/gm, "<h6>$1</h6>");
  html = html.replace(/^##### (.+)$/gm, "<h5>$1</h5>");
  html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g,
    '<a href="$2" rel="noreferrer noopener" target="_blank">$1</a>'
  );
  html = html.replace(/^(?:- (.+)(?:\n|$))+/gm, (block) => {
    const items = block
      .trim()
      .split(/\n/)
      .map((l) => l.replace(/^- /, ""))
      .map((l) => `<li>${l}</li>`)
      .join("");
    return `<ul>${items}</ul>`;
  });
  html = html.replace(/^(?:\d+\. (.+)(?:\n|$))+/gm, (block) => {
    const items = block
      .trim()
      .split(/\n/)
      .map((l) => l.replace(/^\d+\. /, ""))
      .map((l) => `<li>${l}</li>`)
      .join("");
    return `<ol>${items}</ol>`;
  });
  html = html
    .split(/\n{2,}/)
    .map((chunk) =>
      /^<(h\d|ul|ol|pre|blockquote)/i.test(chunk.trim())
        ? chunk
        : `<p>${chunk.replace(/\n/g, "<br/>")}</p>`
    )
    .join("\n");
  return html;
}

"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle,
  Eye,
  EyeOff,
  FileText,
  Inbox,
  Mail,
  Save,
  Send,
  Sparkles,
  UserCheck,
  Users2,
} from "lucide-react";

import { renderEmailPreview } from "@/lib/email/render";
import type { StarterTemplate } from "@/lib/newsletter/starterTemplates";
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
  initialAudienceId?: string | null;
  liveSendEnabled?: boolean;
  audiences?: AudienceOption[];
  ownerEmail?: string;
  ownerName?: string;
  // When true, the "Send test to me only" button renders. The server still
  // re-checks owner role + ALLOW_LIVE_EMAIL_SEND, but rendering nothing for
  // non-owners avoids a confusing dead button.
  isOwner?: boolean;
}

// Pull `metadata.audience_id` out of an EmailCampaign row defensively. The
// column is JSONB so the shape is `Record<string, unknown>` — we can't trust
// it without runtime checks.
function pickAudienceIdFromDraft(
  draft: EmailCampaign | null | undefined
): string | null {
  if (!draft) return null;
  const meta = draft.metadata;
  if (meta && typeof meta === "object") {
    const raw = (meta as Record<string, unknown>).audience_id;
    if (typeof raw === "string" && raw.length > 0) return raw;
  }
  // Fall back to parsing `audience:<uuid>` out of recipient_list — older
  // drafts saved before this polish only stored it there.
  const match = draft.recipient_list?.match(/^audience:([0-9a-f-]{36})$/i);
  return match?.[1] ?? null;
}

export function EmailComposer({
  initialDraft,
  initialAudienceId,
  liveSendEnabled,
  audiences = [],
  ownerEmail = "",
  ownerName = "",
  isOwner = false,
}: Props) {
  const router = useRouter();
  const [campaignId, setCampaignId] = useState<string | null>(
    initialDraft?.id ?? null
  );
  // Live owner test-send state — separate from `info` so the inline result
  // copy doesn't get clobbered by a follow-up Save.
  const [testBusy, setTestBusy] = useState(false);
  const [testNote, setTestNote] = useState<
    | { kind: "ok"; message: string }
    | { kind: "warn"; message: string }
    | { kind: "err"; message: string }
    | null
  >(null);
  const [subject, setSubject] = useState(initialDraft?.subject ?? "");
  const [previewText, setPreviewText] = useState(
    initialDraft?.preview_text ?? ""
  );
  const [body, setBody] = useState(initialDraft?.body_text ?? "");
  // Initial recipients: prefer the draft's saved value, otherwise apply the
  // `audience=<uuid>` deep-link param when present. Free-text fallback is
  // unaffected if the param is missing.
  const [recipients, setRecipients] = useState(() => {
    if (initialDraft?.recipient_list) return initialDraft.recipient_list;
    const fromMeta = pickAudienceIdFromDraft(initialDraft);
    if (fromMeta) return `audience:${fromMeta}`;
    if (initialAudienceId) return `audience:${initialAudienceId}`;
    return "";
  });
  const [showPreview, setShowPreview] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);

  useEffect(() => {
    setCampaignId(initialDraft?.id ?? null);
    setSubject(initialDraft?.subject ?? "");
    setPreviewText(initialDraft?.preview_text ?? "");
    setBody(initialDraft?.body_text ?? "");
    // Restore the audience picker selection in this priority order:
    //   1. The draft's saved recipient_list (free-text or audience:<uuid>)
    //   2. metadata.audience_id on the draft row
    //   3. The /email?audience=<uuid> deep-link param
    const draftMetaAudience = pickAudienceIdFromDraft(initialDraft);
    if (initialDraft?.recipient_list) {
      setRecipients(initialDraft.recipient_list);
    } else if (draftMetaAudience) {
      setRecipients(`audience:${draftMetaAudience}`);
    } else if (initialAudienceId) {
      setRecipients(`audience:${initialAudienceId}`);
    } else {
      setRecipients("");
    }
  }, [initialDraft, initialAudienceId]);

  // Derive the currently selected audience UUID (used by save payload + AI
  // prompt + summary card). When the picker is on free-text mode this is
  // null and we send no `audience_id` to the API.
  const selectedAudienceId = recipients.startsWith("audience:")
    ? recipients.slice("audience:".length)
    : null;
  const selectedAudience = selectedAudienceId
    ? audiences.find((a) => a.id === selectedAudienceId)
    : null;

  // ---------------- Preview (debounced 250ms) ----------------
  // The renderer is cheap, but recomputing the full HTML + the iframe
  // srcdoc on every keystroke causes the preview pane to flicker on long
  // bodies. Debouncing the render — not the input — keeps the textarea
  // responsive while smoothing the iframe redraw.
  const [debouncedSubject, setDebouncedSubject] = useState(subject);
  const [debouncedPreviewText, setDebouncedPreviewText] = useState(previewText);
  const [debouncedBody, setDebouncedBody] = useState(body);
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSubject(subject);
      setDebouncedPreviewText(previewText);
      setDebouncedBody(body);
    }, 250);
    return () => clearTimeout(t);
  }, [subject, previewText, body]);

  // Full inbox-shell HTML. The `html` field is what we drop into the iframe
  // srcdoc and what we POST to /api/email so the saved row + future n8n
  // payload all share one renderer.
  const rendered = useMemo(
    () =>
      renderEmailPreview({
        subject: debouncedSubject || "(No subject)",
        previewText: debouncedPreviewText,
        bodyMarkdown: debouncedBody,
      }),
    [debouncedSubject, debouncedPreviewText, debouncedBody]
  );
  const previewHtml = rendered.html;

  // Live (un-debounced) preview HTML for the save payload — when the user
  // hits Save we want the latest content shipped, not the 250ms-old version.
  const livePreviewHtml = useMemo(
    () =>
      renderEmailPreview({
        subject: subject || "(No subject)",
        previewText,
        bodyMarkdown: body,
      }).html,
    [subject, previewText, body]
  );

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
          headers: {
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({
            campaign_id: campaignId,
            subject,
            preview_text: previewText || undefined,
            body_text: body,
            body_html: livePreviewHtml,
            recipient_list: recipients || undefined,
            audience_id: selectedAudienceId ?? undefined,
            action,
          }),
        });
        // Defensive parse — mirror AtlasShell. A 401 page or CDN error
        // would otherwise blow up on res.json().
        const ct = res.headers.get("content-type") ?? "";
        if (!ct.includes("application/json")) {
          setError(
            res.status === 401
              ? "Your session expired. Refresh and sign in again."
              : "Email Studio received a non JSON response. Please refresh and try again."
          );
          return;
        }
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

  // ---------------- AI Write ----------------
  // Hits /api/ai/chat — same endpoint Atlas uses — with a single shaped
  // prompt that asks for a newsletter draft seeded by the current subject
  // and the selected audience name. We don't pass a thread/assistant id
  // so each call is one-shot. Response is plain markdown which we drop
  // directly into the body field (and the subject if empty).
  const aiAbortRef = useRef<AbortController | null>(null);
  async function runAiWrite() {
    if (aiBusy) return;
    setError(null);
    setInfo(null);
    setAiNote(null);
    setAiBusy(true);
    aiAbortRef.current?.abort();
    aiAbortRef.current = new AbortController();
    try {
      const seedSubject = subject.trim();
      const audienceLabel = selectedAudience
        ? `${selectedAudience.name} (${selectedAudience.active} active contacts)`
        : "a general newsletter list";
      const prompt = [
        "Draft a short, friendly real-estate / mortgage newsletter in Markdown.",
        seedSubject
          ? `The subject line is: "${seedSubject}". Keep the body aligned with that topic.`
          : "Suggest a single H1 line as the implied subject, then the body.",
        `Audience: ${audienceLabel}.`,
        "Use 2-3 short paragraphs, one bullet list of 3 takeaways, and a single call-to-action link placeholder like [Schedule a call](#).",
        "No emoji. No salutation like 'Dear ...'. Do not wrap the response in code fences.",
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

      // Defensive parse — same pattern as AtlasShell / SocialComposer.
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
            data.message ??
              "AI provider is currently disabled in Settings."
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

      // If the response starts with a markdown H1 AND the subject field is
      // empty, lift that into the subject. Otherwise leave subject alone.
      if (!seedSubject) {
        const h1Match = content.match(/^# +(.+)$/m);
        if (h1Match?.[1]) {
          setSubject(h1Match[1].trim().slice(0, 300));
          setBody(content.replace(/^# +.+$/m, "").trimStart());
        } else {
          setBody(content);
        }
      } else {
        setBody(content);
      }
      setAiNote("AI Write applied. Review the body before sending.");
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") return;
      setAiNote(
        e instanceof Error
          ? `AI Write failed: ${e.message}`
          : "AI Write failed."
      );
    } finally {
      setAiBusy(false);
    }
  }

  // ---------------- Owner test send ----------------
  // Calls the dedicated /api/email/test-send route. The server enforces
  // owner role + ALLOW_LIVE_EMAIL_SEND. When the flag is off we get back
  // { ok:false, error:"live_send_disabled" } and show the env-flip copy
  // verbatim — no toast/snackbar plumbing required.
  async function runTestSend() {
    if (testBusy) return;
    if (!campaignId) {
      setTestNote({
        kind: "warn",
        message:
          "Save the draft first — a campaign id is required before queuing a test send.",
      });
      return;
    }
    setTestBusy(true);
    setTestNote(null);
    try {
      const res = await fetch("/api/email/test-send", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          campaign_id: campaignId,
          recipient: ownerEmail || undefined,
        }),
      });
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) {
        setTestNote({
          kind: "err",
          message:
            res.status === 401
              ? "Your session expired. Refresh and sign in again."
              : "Test send received a non JSON response. Please retry in a moment.",
        });
        return;
      }
      const data = await res.json();
      if (!data.ok) {
        if (data.error === "live_send_disabled") {
          setTestNote({
            kind: "warn",
            message:
              "Test send disabled — flip ALLOW_LIVE_EMAIL_SEND in Netlify env vars when ready.",
          });
        } else if (data.error === "forbidden") {
          setTestNote({
            kind: "warn",
            message: "Only the owner account can run test sends.",
          });
        } else if (data.error === "bad_status") {
          setTestNote({
            kind: "warn",
            message:
              data.message ?? "Test send only allowed on draft or approved campaigns.",
          });
        } else {
          setTestNote({
            kind: "err",
            message: `${data.error}: ${data.message ?? "test send failed"}`,
          });
        }
        return;
      }
      const jobStatus = data.job?.status ?? "queued";
      const where = data.recipient || ownerEmail || "owner inbox";
      setTestNote({
        kind: "ok",
        message:
          jobStatus === "sent"
            ? `Test dispatched to ${where} via n8n.`
            : `Test queued for ${where} (n8n status: ${jobStatus}).`,
      });
      router.refresh();
    } catch (e) {
      setTestNote({
        kind: "err",
        message: e instanceof Error ? e.message : "Test send failed.",
      });
    } finally {
      setTestBusy(false);
    }
  }

  return (
    <section className="card-padded space-y-3">
      <div className="section-title">
        <div>
          <h2>{campaignId ? "Edit campaign" : "Compose newsletter"}</h2>
          <p>Drafts save instantly. External sending only runs when the owner enables it.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={runAiWrite}
            className="btn-ghost text-xs"
            disabled={aiBusy}
            title="Draft this newsletter with AI using the current subject + audience"
          >
            <Sparkles
              size={12}
              className={cn(aiBusy && "animate-pulse text-accent-gold")}
            />
            {aiBusy ? "AI writing…" : "AI Write"}
          </button>
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
      </div>

      {aiNote && (
        <p className="rounded-lg border border-status-info/30 bg-status-info/10 px-3 py-2 text-xs text-status-info">
          {aiNote}
        </p>
      )}

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
            {/* Inbox preview card — matches the dashboard "Latest newsletter"
                card visual (rounded ink-950 panel, gold-tinted eyebrow). The
                iframe is sized like a real inbox: max-width ~600px so the
                preview matches what the recipient sees in Gmail / Outlook. */}
            <div className="overflow-hidden rounded-xl border border-ink-800 bg-ink-950">
              <div className="flex items-center justify-between gap-2 border-b border-ink-800 px-3 py-1.5">
                <p className="text-[10px] uppercase tracking-[0.18em] text-ink-300">
                  Inbox preview
                </p>
                <p className="text-[10px] text-ink-400">
                  Same shell ships to n8n on Queue send
                </p>
              </div>
              <div className="border-b border-ink-800 bg-ink-900/40 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.18em] text-ink-300">
                  Subject
                </p>
                <p className="mt-1 truncate font-medium text-ink-100">
                  {subject || "Subject preview"}
                </p>
                <p className="truncate text-xs text-ink-300">
                  {previewText || "Preview text appears here"}
                </p>
              </div>
              <div className="flex justify-center bg-ink-950 px-3 py-4">
                <iframe
                  title="Email preview"
                  srcDoc={previewHtml}
                  sandbox=""
                  className="block h-[520px] w-full max-w-[600px] rounded-lg border border-ink-800 bg-ink-950"
                />
              </div>
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

      {isOwner && (
        <div className="rounded-xl border border-ink-800 bg-ink-900/40 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn text-xs"
              onClick={runTestSend}
              disabled={testBusy || !campaignId || !body.trim() || !ownerEmail}
              title={
                ownerEmail
                  ? `Sends only to ${ownerEmail}, even if an audience is selected.`
                  : "Owner email is not configured."
              }
            >
              <Inbox size={12} className={cn(testBusy && "animate-pulse")} />
              {testBusy
                ? "Dispatching test…"
                : `Send test to me only${
                    ownerEmail ? ` (${ownerEmail})` : ""
                  }`}
            </button>
            <p className="text-[11px] text-ink-300">
              Owner-only, single-recipient. Audience is ignored for this
              button — only your inbox is hit.
            </p>
          </div>
          {testNote && (
            <p
              className={cn(
                "mt-2 rounded-lg border px-3 py-1.5 text-xs",
                testNote.kind === "ok" &&
                  "border-status-ok/30 bg-status-ok/10 text-status-ok",
                testNote.kind === "warn" &&
                  "border-status-warn/30 bg-status-warn/10 text-status-warn",
                testNote.kind === "err" &&
                  "border-status-err/30 bg-status-err/10 text-status-err"
              )}
            >
              {testNote.message}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Starter templates panel
// ---------------------------------------------------------------------------
//
// Renders on /email when the org has zero email_campaigns rows. Each card
// creates a new draft via POST /api/email (same path the composer uses) and
// then navigates to /email?id=<new>. No bespoke endpoint, no migrations.

interface StarterTemplatesPanelProps {
  templates: StarterTemplate[];
}

export function StarterTemplatesPanel({ templates }: StarterTemplatesPanelProps) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(t: StarterTemplate) {
    if (busyKey) return;
    setBusyKey(t.key);
    setError(null);
    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          subject: t.subject,
          preview_text: t.preview_text,
          body_text: t.body_markdown,
          template_key: t.key,
          action: "draft",
        }),
      });
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) {
        setError(
          res.status === 401
            ? "Your session expired. Refresh and sign in again."
            : "Starter templates received a non JSON response."
        );
        return;
      }
      const data = await res.json();
      if (!data.ok || !data.campaign?.id) {
        setError(`${data.error ?? "internal_error"}: ${data.message ?? "failed"}`);
        return;
      }
      router.push(`/email?id=${data.campaign.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Starter template failed.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <section className="card-padded space-y-3">
      <div className="section-title">
        <div>
          <h2 className="flex items-center gap-2">
            <FileText size={14} className="text-accent-gold" />
            Start from a template
          </h2>
          <p>
            Three premium-mortgage starts — every word is editable once the
            draft opens.
          </p>
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {templates.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => pick(t)}
            disabled={busyKey !== null}
            className={cn(
              "group flex flex-col gap-2 rounded-xl border border-ink-800 bg-ink-900/40 p-3 text-left transition",
              busyKey === t.key
                ? "border-accent-gold/40 bg-accent-gold/10"
                : "hover:border-accent-gold/30 hover:bg-ink-900/60"
            )}
          >
            <p className="text-[10px] uppercase tracking-[0.18em] text-ink-300">
              Newsletter starter
            </p>
            <p className="text-sm font-semibold text-ink-100">{t.subject}</p>
            <p className="text-[11px] text-ink-300">{t.preview_text}</p>
            <p className="mt-auto pt-1 text-[10px] text-ink-400 group-hover:text-accent-gold">
              {busyKey === t.key ? "Creating draft…" : t.blurb}
            </p>
          </button>
        ))}
      </div>
      {error && (
        <p className="rounded-lg border border-status-err/30 bg-status-err/10 px-3 py-2 text-xs text-status-err">
          {error}
        </p>
      )}
    </section>
  );
}

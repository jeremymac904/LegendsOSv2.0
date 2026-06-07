"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Mail, Send, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

interface Props {
  // Optional prefill from the current Email Studio draft. Changing these
  // re-seeds the fields (e.g. switching campaigns in the composer).
  subject?: string;
  body?: string;
  // Optional default recipient (e.g. the signed-in user's own email) so a
  // user can quickly send themselves a copy.
  defaultTo?: string;
}

// The /api/integrations/google/gmail route returns one of these honest
// statuses. We mirror them exactly so the UI never invents a state.
type SendResult =
  | { kind: "idle" }
  | { kind: "ok"; message: string }
  | { kind: "draft"; message: string }
  | { kind: "not_connected"; message: string }
  | { kind: "disabled_by_user"; message: string }
  | { kind: "needs_setup"; message: string }
  | { kind: "error"; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * GmailSendPanel — lets the signed-in user send (or draft) a single real
 * email through THEIR OWN connected Gmail via the existing gated route:
 *
 *   POST /api/integrations/google/gmail
 *     { action: 'send', to, subject, body, confirm: true }   ← live, gated
 *     { action: 'create_draft', to, subject, body }          ← no live gate
 *
 * The live send is double-gated server-side (connection + user-enabled live
 * email + confirm===true). On top of that, this panel requires an explicit
 * in-UI confirm checkbox so confirm:true is always a deliberate user action.
 */
export function GmailSendPanel({ subject = "", body = "", defaultTo = "" }: Props) {
  const [to, setTo] = useState(defaultTo);
  const [subj, setSubj] = useState(subject);
  const [text, setText] = useState(body);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<"send" | "draft" | null>(null);
  const [result, setResult] = useState<SendResult>({ kind: "idle" });

  // Re-seed when the parent passes a different draft. We only sync the
  // subject/body the panel was given — the recipient is the user's own input
  // and should not be clobbered by a draft change.
  useEffect(() => {
    setSubj(subject);
    setText(body);
    // A content change invalidates a prior confirmation — never carry a
    // "confirmed" state across a draft swap.
    setConfirmed(false);
    setResult({ kind: "idle" });
  }, [subject, body]);

  const toValid = EMAIL_RE.test(to.trim());
  const canSend = toValid && subj.trim().length > 0 && text.trim().length > 0;

  // Map the route's JSON into one of our honest result states. The route may
  // return: status 'sent' | 'ok' | 'not_connected' | 'needs_reauth' |
  // 'needs_setup' | 'disabled_by_user' | 'error', or an error field of
  // 'confirmation_required' / 'bad_request' / 'unauthenticated'.
  function interpret(data: unknown, mode: "send" | "draft"): SendResult {
    const d = (data ?? {}) as Record<string, unknown>;
    const status = typeof d.status === "string" ? d.status : "";
    const errorCode = typeof d.error === "string" ? d.error : "";
    const message = typeof d.message === "string" ? d.message : "";

    if (d.ok === true) {
      if (mode === "draft") {
        return { kind: "draft", message: "Draft created in your Gmail." };
      }
      return { kind: "ok", message: "Sent ✓" };
    }

    // Connection gate failures.
    if (status === "not_connected" || status === "needs_reauth") {
      return {
        kind: "not_connected",
        message: "Connect your Gmail in Settings first.",
      };
    }
    if (status === "needs_setup") {
      return {
        kind: "needs_setup",
        message:
          message ||
          "Gmail is not available yet — Google OAuth is not configured. Ask the owner to set it up.",
      };
    }
    // Live-action gate (user disabled live email).
    if (status === "disabled_by_user") {
      return {
        kind: "disabled_by_user",
        message: "Enable live email in Settings → Live actions.",
      };
    }
    // Confirmation gate — should not happen since we send confirm:true, but
    // handle it honestly rather than as a generic error.
    if (errorCode === "confirmation_required") {
      return {
        kind: "error",
        message: "Confirmation required — check the confirm box and try again.",
      };
    }
    if (errorCode === "unauthenticated") {
      return {
        kind: "error",
        message: "Your session expired. Refresh and sign in again.",
      };
    }
    return {
      kind: "error",
      message: message || "Gmail request failed. Please try again.",
    };
  }

  async function post(action: "send" | "create_draft") {
    const mode = action === "send" ? "send" : "draft";
    setBusy(mode);
    setResult({ kind: "idle" });
    try {
      const res = await fetch("/api/integrations/google/gmail", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          action,
          to: to.trim(),
          subject: subj,
          body: text,
          // confirm only matters for 'send'; the route ignores it otherwise.
          ...(action === "send" ? { confirm: true } : {}),
        }),
      });
      // Defensive parse — a 401 HTML page or CDN error must not crash.
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) {
        setResult({
          kind: "error",
          message:
            res.status === 401
              ? "Your session expired. Refresh and sign in again."
              : "Gmail returned a non JSON response. Please retry in a moment.",
        });
        return;
      }
      const data = await res.json().catch(() => null);
      setResult(interpret(data, mode));
      // A successful live send consumes the confirmation — require a fresh
      // explicit confirm before any subsequent send.
      if (action === "send") setConfirmed(false);
    } catch (e) {
      setResult({
        kind: "error",
        message: e instanceof Error ? e.message : "Gmail request failed.",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card-padded space-y-3">
      <div className="section-title">
        <div>
          <h2 className="flex items-center gap-2">
            <Mail size={14} className="text-accent-gold" />
            Send via my Gmail
          </h2>
          <p>
            Send a single real email through your own connected Gmail. This is
            separate from campaign sending — it goes only to the address you
            enter below.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <input
          className="input"
          type="email"
          placeholder="To (recipient email)"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            // Editing the recipient after confirming should re-arm the gate.
            setConfirmed(false);
          }}
          maxLength={320}
          aria-label="Recipient email"
        />
        <input
          className="input"
          placeholder="Subject"
          value={subj}
          onChange={(e) => {
            setSubj(e.target.value);
            setConfirmed(false);
          }}
          maxLength={998}
          aria-label="Email subject"
        />
        <textarea
          className="textarea min-h-[160px] text-[13px]"
          placeholder="Body — plain text or Markdown from your draft."
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setConfirmed(false);
          }}
          aria-label="Email body"
        />
        {to.trim().length > 0 && !toValid && (
          <p className="text-[11px] text-status-warn">
            Enter a valid recipient email address.
          </p>
        )}
      </div>

      {/* Explicit confirm step — confirm:true is only ever sent after the user
          deliberately checks this box. Never auto-send. */}
      <label
        className={cn(
          "flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2.5 transition",
          confirmed
            ? "border-accent-gold/40 bg-accent-gold/5"
            : "border-ink-200 bg-white/70 dark:border-ink-800 dark:bg-ink-900/40"
        )}
      >
        <input
          type="checkbox"
          className="mt-0.5"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          aria-label="Confirm I want to send this real email"
        />
        <span className="text-[12px] text-ink-700 dark:text-ink-300">
          <span className="flex items-center gap-1.5 font-medium text-ink-900 dark:text-ink-100">
            <ShieldCheck size={12} className="text-accent-gold" />
            Yes, send this real email from my Gmail
          </span>
          <span className="mt-0.5 block text-[11px] text-ink-600 dark:text-ink-400">
            This delivers to {toValid ? to.trim() : "the recipient above"}. Live
            email must be enabled in Settings → Live actions.
          </span>
        </span>
      </label>

      {result.kind !== "idle" && (
        <div
          className={cn(
            "rounded-lg border px-3 py-2 text-xs",
            result.kind === "ok" &&
              "border-status-ok/30 bg-status-ok/10 text-status-ok",
            result.kind === "draft" &&
              "border-status-info/30 bg-status-info/10 text-status-info",
            (result.kind === "not_connected" ||
              result.kind === "disabled_by_user" ||
              result.kind === "needs_setup") &&
              "border-status-warn/30 bg-status-warn/10 text-status-warn",
            result.kind === "error" &&
              "border-status-err/30 bg-status-err/10 text-status-err"
          )}
        >
          <p>{result.message}</p>
          {(result.kind === "not_connected" ||
            result.kind === "disabled_by_user") && (
            <Link
              href="/settings"
              className="mt-1 inline-block font-medium underline underline-offset-2"
            >
              Open Settings →
            </Link>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary"
          onClick={() => post("send")}
          disabled={busy !== null || !canSend || !confirmed}
          title={
            !canSend
              ? "Enter a valid recipient, subject, and body first."
              : !confirmed
                ? "Check the confirm box to enable sending."
                : "Send this email from your connected Gmail."
          }
        >
          <Send size={14} className={cn(busy === "send" && "animate-pulse")} />
          {busy === "send" ? "Sending…" : "Send via my Gmail"}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => post("create_draft")}
          disabled={busy !== null || !canSend}
          title="Create a Gmail draft without sending (no live gate)."
        >
          <FileText
            size={14}
            className={cn(busy === "draft" && "animate-pulse")}
          />
          {busy === "draft" ? "Creating draft…" : "Create draft instead"}
        </button>
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-ink-600 dark:text-ink-400">
          Sends from your account — tokens never leave the server.
        </span>
      </div>
    </section>
  );
}

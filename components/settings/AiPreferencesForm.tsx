"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

// Mirrors the GET payload from /api/loan-memory/preferences.
interface VoiceOption {
  id: string;
  label: string;
  rules: string;
  defaultSignature: string;
}

interface PreferencesPayload {
  tone_profile: string;
  communication_rules: string | null;
  approval_required: boolean;
  default_signature: string | null;
  preferred_response_format: string;
}

interface ApiState {
  ok: boolean;
  is_default?: boolean;
  table_missing?: boolean;
  preferences: PreferencesPayload;
  voices: VoiceOption[];
  default_voice_id: string;
  message?: string;
}

const CUSTOM_ID = "custom";

const RESPONSE_FORMATS: { value: string; label: string }[] = [
  { value: "status_blocker_next", label: "Status / what matters / next action / missing" },
  { value: "short", label: "Short — answer first, minimal detail" },
  { value: "detailed", label: "Detailed — full context and reasoning" },
];

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

export function AiPreferencesForm() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [toneProfile, setToneProfile] = useState<string>("");
  const [communicationRules, setCommunicationRules] = useState("");
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [defaultSignature, setDefaultSignature] = useState("");
  const [responseFormat, setResponseFormat] = useState("status_blocker_next");

  const [save, setSave] = useState<SaveState>({ kind: "idle" });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/loan-memory/preferences");
        const data = (await res.json()) as ApiState;
        if (!active) return;
        if (!data.ok) {
          setLoadError(data.message ?? "Could not load preferences.");
          setLoading(false);
          return;
        }
        setVoices(data.voices ?? []);
        setTableMissing(Boolean(data.table_missing));
        setNotice(data.message ?? null);
        const p = data.preferences;
        setToneProfile(p.tone_profile || data.default_voice_id);
        setCommunicationRules(p.communication_rules ?? "");
        setApprovalRequired(p.approval_required ?? true);
        setDefaultSignature(p.default_signature ?? "");
        setResponseFormat(p.preferred_response_format || "status_blocker_next");
      } catch (e) {
        if (active) setLoadError(e instanceof Error ? e.message : "Network error.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const isCustom = toneProfile === CUSTOM_ID || !voices.some((v) => v.id === toneProfile);
  const activeVoice = voices.find((v) => v.id === toneProfile);

  // Picking a preset voice seeds its rules + signature (only when the field is
  // empty or still matches another preset's text, so we never clobber edits).
  function selectVoice(id: string) {
    setSave({ kind: "idle" });
    if (id === CUSTOM_ID) {
      setToneProfile(CUSTOM_ID);
      return;
    }
    const v = voices.find((x) => x.id === id);
    setToneProfile(id);
    if (!v) return;
    const presetRules = voices.map((x) => x.rules);
    const presetSigs = voices.map((x) => x.defaultSignature);
    if (!communicationRules.trim() || presetRules.includes(communicationRules)) {
      setCommunicationRules(v.rules);
    }
    if (!defaultSignature.trim() || presetSigs.includes(defaultSignature)) {
      setDefaultSignature(v.defaultSignature);
    }
  }

  async function handleSave() {
    setSave({ kind: "saving" });
    try {
      const res = await fetch("/api/loan-memory/preferences", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tone_profile: toneProfile || "jeremy",
          communication_rules: communicationRules,
          approval_required: approvalRequired,
          default_signature: defaultSignature,
          preferred_response_format: responseFormat,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setSave({
          kind: "error",
          message:
            data?.message ??
            data?.error ??
            `Save failed (${res.status}).`,
        });
        if (data?.table_missing) setTableMissing(true);
        return;
      }
      setTableMissing(false);
      setSave({ kind: "saved" });
    } catch (e) {
      setSave({
        kind: "error",
        message: e instanceof Error ? e.message : "Network error while saving.",
      });
    }
  }

  const inputCls =
    "w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none transition focus:border-accent-gold/60 dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-100";
  const labelCls =
    "text-[11px] font-medium uppercase tracking-[0.14em] text-ink-600 dark:text-ink-300";

  if (loading) {
    return (
      <div className="rounded-xl border border-ink-200 bg-white p-4 text-sm text-ink-600 dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-300">
        Loading your preferences…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-status-err/40 bg-status-err/10 p-4 text-sm text-ink-900 dark:text-ink-100">
        {loadError}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {(tableMissing || notice) && (
        <div className="rounded-xl border border-status-warn/40 bg-status-warn/10 p-3 text-[13px] text-ink-700 dark:text-ink-200">
          {notice ??
            "Loan Memory migration not applied yet — you can review defaults, but saving is disabled until the table exists."}
        </div>
      )}

      {/* Voice profile picker */}
      <div className="space-y-2">
        <span className={labelCls}>Voice profile</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {voices.map((v) => {
            const selected = toneProfile === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => selectVoice(v.id)}
                className={cn(
                  "rounded-xl border p-3 text-left transition",
                  selected
                    ? "border-accent-gold/60 bg-accent-gold/10"
                    : "border-ink-200 bg-white hover:border-ink-300 dark:border-ink-800 dark:bg-ink-950/40 dark:hover:border-ink-700"
                )}
              >
                <p className="text-sm font-medium text-ink-900 dark:text-ink-100">
                  {v.label}
                </p>
                <p className="mt-1 line-clamp-3 text-[12px] leading-relaxed text-ink-600 dark:text-ink-300">
                  {v.rules}
                </p>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => selectVoice(CUSTOM_ID)}
            className={cn(
              "rounded-xl border p-3 text-left transition",
              isCustom
                ? "border-accent-gold/60 bg-accent-gold/10"
                : "border-ink-200 bg-white hover:border-ink-300 dark:border-ink-800 dark:bg-ink-950/40 dark:hover:border-ink-700"
            )}
          >
            <p className="text-sm font-medium text-ink-900 dark:text-ink-100">
              Custom voice
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-600 dark:text-ink-300">
              Write your own communication rules and signature below.
            </p>
          </button>
        </div>
        {activeVoice && (
          <p className="text-[11px] text-ink-600 dark:text-ink-300">
            Default signature for {activeVoice.label}:{" "}
            <span className="whitespace-pre-wrap">
              {activeVoice.defaultSignature.replace(/\n/g, " · ")}
            </span>
          </p>
        )}
      </div>

      {/* Communication rules */}
      <div className="space-y-1.5">
        <label htmlFor="ai-pref-rules" className={labelCls}>
          Communication rules
        </label>
        <textarea
          id="ai-pref-rules"
          value={communicationRules}
          onChange={(e) => {
            setCommunicationRules(e.target.value);
            setSave({ kind: "idle" });
          }}
          rows={4}
          placeholder="How should the assistant write on your behalf? Tone, do/don'ts, phrasing."
          className={cn(inputCls, "resize-y leading-relaxed")}
        />
      </div>

      {/* Response format */}
      <div className="space-y-1.5">
        <label htmlFor="ai-pref-format" className={labelCls}>
          Preferred response format
        </label>
        <select
          id="ai-pref-format"
          value={responseFormat}
          onChange={(e) => {
            setResponseFormat(e.target.value);
            setSave({ kind: "idle" });
          }}
          className={inputCls}
        >
          {RESPONSE_FORMATS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
          {!RESPONSE_FORMATS.some((f) => f.value === responseFormat) && (
            <option value={responseFormat}>{responseFormat}</option>
          )}
        </select>
      </div>

      {/* Default signature */}
      <div className="space-y-1.5">
        <label htmlFor="ai-pref-sig" className={labelCls}>
          Default signature
        </label>
        <textarea
          id="ai-pref-sig"
          value={defaultSignature}
          onChange={(e) => {
            setDefaultSignature(e.target.value);
            setSave({ kind: "idle" });
          }}
          rows={2}
          placeholder="Name and team line appended to drafted outbound messages."
          className={cn(inputCls, "resize-y leading-relaxed")}
        />
      </div>

      {/* Approval required */}
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink-200 bg-white p-3 dark:border-ink-800 dark:bg-ink-950/40">
        <input
          type="checkbox"
          checked={approvalRequired}
          onChange={(e) => {
            setApprovalRequired(e.target.checked);
            setSave({ kind: "idle" });
          }}
          className="mt-0.5 h-4 w-4 accent-accent-gold"
        />
        <span>
          <span className="block text-sm font-medium text-ink-900 dark:text-ink-100">
            Require my approval before any outbound action
          </span>
          <span className="mt-0.5 block text-[12px] text-ink-600 dark:text-ink-300">
            When on, the assistant drafts and waits for you. It never sends email,
            texts, or pipeline updates on its own.
          </span>
        </span>
      </label>

      {/* Save row */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={save.kind === "saving"}
          className={cn(
            "rounded-lg border border-accent-gold/50 bg-accent-gold/15 px-4 py-2 text-sm font-medium text-ink-900 transition hover:bg-accent-gold/25 dark:text-ink-100",
            save.kind === "saving" && "cursor-not-allowed opacity-60"
          )}
        >
          {save.kind === "saving" ? "Saving…" : "Save preferences"}
        </button>
        {save.kind === "saved" && (
          <span className="text-[13px] text-status-ok">Saved.</span>
        )}
        {save.kind === "error" && (
          <span className="text-[13px] text-status-err">{save.message}</span>
        )}
      </div>
    </div>
  );
}

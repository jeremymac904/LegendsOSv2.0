"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

const ASPECTS = ["1:1", "16:9", "9:16", "4:3", "3:4"] as const;
const PRESETS = [
  {
    id: "rate_drop",
    label: "Rate-drop alert",
    prompt:
      "Premium cinematic banner: bold orange-gold gradient, modern home in soft focus, large overlay text 'Rates Just Dropped', subtle Legends Mortgage Team mark. Do not bake any NMLS branding line into the image — that text is added separately at composition time.",
  },
  {
    id: "first_time_buyer",
    label: "First-time buyer",
    prompt:
      "Warm, hopeful image of a young couple holding keys in front of a suburban home, dusk lighting, brand gold accents, polished editorial look, premium mortgage marketing.",
  },
  {
    id: "refi_savings",
    label: "Refi savings",
    prompt:
      "Editorial flat-lay of mortgage paperwork with a calculator and a sleek pen, deep navy background with gold accents, headline space at top reading 'Refi & Save'.",
  },
] as const;

export function ImageStudioClient() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<(typeof ASPECTS)[number]>("1:1");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function generate() {
    setError(null);
    setInfo(null);
    setPreview(null);
    if (prompt.trim().length < 3) {
      setError("Add a longer prompt.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/ai/image", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt, aspect_ratio: aspect }),
        });
        const data = await res.json();
        if (!data.ok) {
          setError(`${data.error}: ${data.message}`);
          return;
        }
        setPreview(data.preview_url ?? null);
        setInfo("Generated. Saved to library.");
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
          <h2>Generate</h2>
          <p>Fal.ai server-side. Cost cap enforced per day.</p>
        </div>
      </div>
      <div>
        <p className="label">Brand presets</p>
        <div className="mt-2 grid grid-cols-1 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPrompt(p.prompt)}
              className="rounded-xl border border-ink-800 bg-ink-900/50 p-2 text-left text-xs text-ink-200 hover:border-accent-gold/30"
            >
              <p className="font-medium text-ink-100">{p.label}</p>
              <p className="mt-1 line-clamp-2 text-[11px] text-ink-300">{p.prompt}</p>
            </button>
          ))}
        </div>
      </div>
      <textarea
        className="textarea min-h-[140px]"
        placeholder="Describe the image…"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <div>
        <p className="label">Aspect ratio</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {ASPECTS.map((a) => (
            <button
              key={a}
              onClick={() => setAspect(a)}
              className={cn(
                "rounded-lg border px-2.5 py-1 text-xs",
                aspect === a
                  ? "border-accent-gold/40 bg-accent-gold/10 text-accent-gold"
                  : "border-ink-700 text-ink-200 hover:border-ink-500"
              )}
            >
              {a}
            </button>
          ))}
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
      <button
        className="btn-primary w-full"
        onClick={generate}
        disabled={isPending}
      >
        <Sparkles size={14} />
        {isPending ? "Generating…" : "Generate image"}
      </button>
      {preview && (
        <div className="overflow-hidden rounded-xl border border-ink-800 bg-checker">
          <img src={preview} alt={prompt} className="w-full" />
          <p className="border-t border-ink-800 p-2 text-[11px] text-ink-300">
            <ImageIcon className="inline" size={12} /> Preview
          </p>
        </div>
      )}
    </section>
  );
}

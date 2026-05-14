"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ImageIcon, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Guided composer — choice-based controls
// ---------------------------------------------------------------------------
//
// The Image Studio used to lean on a raw prompt textarea. To make the demo
// feel intentional and on-brand, we instead drive generation through chip
// groups + dropdowns. The composer assembles a structured prompt internally
// and surfaces it read-only beneath the controls. A collapsed "Advanced
// details" disclosure lets a power user override the raw prompt — but the
// default flow never asks the user to type one.

const IMAGE_TYPES = [
  { id: "social_post", label: "Social post" },
  { id: "email_header", label: "Email header" },
  { id: "blog_banner", label: "Blog banner" },
  { id: "hero", label: "Hero" },
  { id: "logo_accent", label: "Logo accent" },
  { id: "background", label: "Background" },
] as const;
type ImageTypeId = (typeof IMAGE_TYPES)[number]["id"];

const CHANNELS = [
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "gbp", label: "GBP" },
  { id: "youtube", label: "YouTube" },
  { id: "newsletter", label: "Newsletter" },
  { id: "website", label: "Website" },
] as const;
type ChannelId = (typeof CHANNELS)[number]["id"];

const TONES = [
  { id: "warm", label: "Warm" },
  { id: "professional", label: "Professional" },
  { id: "cinematic", label: "Cinematic" },
  { id: "editorial", label: "Editorial" },
  { id: "minimal", label: "Minimal" },
  { id: "playful", label: "Playful" },
] as const;
type ToneId = (typeof TONES)[number]["id"];

const COLOR_EMPHASES = [
  {
    id: "gold",
    label: "Gold",
    description: "Brand gold (warm amber) dominant; charcoal as accent.",
  },
  {
    id: "charcoal",
    label: "Charcoal",
    description: "Deep charcoal dominant; gold reserved for accent strokes.",
  },
  {
    id: "mixed",
    label: "Mixed",
    description: "Balanced charcoal + gold palette with editorial contrast.",
  },
] as const;
type ColorEmphasisId = (typeof COLOR_EMPHASES)[number]["id"];

const SUBJECTS = [
  { id: "borrower_portrait", label: "Family / borrower portrait" },
  { id: "home_exterior", label: "Home exterior" },
  { id: "interior", label: "Interior" },
  { id: "abstract", label: "Abstract" },
  { id: "team_branded", label: "Team / branded" },
  { id: "no_people", label: "No people" },
] as const;
type SubjectId = (typeof SUBJECTS)[number]["id"];

const OUTPUT_SIZES = [
  { id: "1:1", label: "Square 1:1" },
  { id: "9:16", label: "Vertical 9:16" },
  { id: "16:9", label: "Horizontal 16:9" },
  { id: "4:5", label: "Standard 4:5" },
] as const;
type OutputSizeId = (typeof OUTPUT_SIZES)[number]["id"];

// 4:5 Instagram portrait isn't a native Fal image_size, so we send 3:4 over
// the wire (closest aspect on the provider) while keeping the chip labeled
// "Standard 4:5" for the user. Everything else passes through directly.
function mapSizeForApi(id: OutputSizeId): "1:1" | "16:9" | "9:16" | "4:3" | "3:4" {
  if (id === "4:5") return "3:4";
  return id;
}

// ---------------------------------------------------------------------------
// FAL readiness chip — three states
// ---------------------------------------------------------------------------

export type FalReadiness = "ready" | "configured_but_paid_off" | "not_configured";

export interface ReferenceAsset {
  id: string;
  label: string;
  public_path: string | null;
  // We only use this for the user-facing tag in the dropdown. The reference
  // never causes a new FAL call shape — we either append the asset's public
  // URL or its label to the prompt and let the existing /api/ai/image
  // endpoint handle the rest.
  source: "uploaded" | "library";
}

interface Props {
  falReadiness: FalReadiness;
  referenceAssets: ReferenceAsset[];
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

interface Choices {
  type: ImageTypeId;
  channel: ChannelId;
  tone: ToneId;
  colorEmphasis: ColorEmphasisId;
  subject: SubjectId;
  referenceId: string; // "" means none
}

function labelOf<T extends { id: string; label: string }>(
  list: readonly T[],
  id: string
): string {
  return list.find((x) => x.id === id)?.label ?? id;
}

function subjectClause(subject: SubjectId): string {
  switch (subject) {
    case "borrower_portrait":
      return "centered on a warm family or borrower portrait moment";
    case "home_exterior":
      return "featuring a polished home exterior in soft natural light";
    case "interior":
      return "featuring a tasteful, sunlit interior scene";
    case "abstract":
      return "with an abstract, editorial composition (no recognizable faces)";
    case "team_branded":
      return "featuring branded team energy — no logos baked in";
    case "no_people":
      return "with no people in frame, scene-driven composition";
  }
}

function buildPrompt(choices: Choices, ref: ReferenceAsset | null): string {
  const type = labelOf(IMAGE_TYPES, choices.type).toLowerCase();
  const channel = labelOf(CHANNELS, choices.channel);
  const tone = labelOf(TONES, choices.tone).toLowerCase();
  const colorMeta = COLOR_EMPHASES.find((c) => c.id === choices.colorEmphasis);
  const subject = subjectClause(choices.subject);

  const refClause = ref
    ? ref.public_path
      ? ` Reference style: ${ref.label} (${ref.public_path}).`
      : ` Reference style: ${ref.label}.`
    : "";

  return [
    `A ${tone}, ${channel}-ready ${type}: ${subject}.`,
    `Brand: Legends Mortgage gold + charcoal.`,
    `${colorMeta?.description ?? ""}${refClause}`,
    `Premium editorial quality, no baked-in logos or NMLS branding text.`,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Provider readiness chip
// ---------------------------------------------------------------------------

function ReadinessChip({ state }: { state: FalReadiness }) {
  if (state === "ready") {
    return (
      <span className="chip-ok">
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full bg-status-ok"
        />
        FAL · Ready
      </span>
    );
  }
  if (state === "configured_but_paid_off") {
    return (
      <span className="chip-warn">
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full bg-accent-gold"
        />
        FAL · Configured but paid generation disabled
      </span>
    );
  }
  return (
    <span className="chip-off">
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full bg-status-off"
      />
      FAL · Not configured
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImageStudioClient({ falReadiness, referenceAssets }: Props) {
  const router = useRouter();

  const [type, setType] = useState<ImageTypeId>("social_post");
  const [channel, setChannel] = useState<ChannelId>("facebook");
  const [tone, setTone] = useState<ToneId>("warm");
  const [colorEmphasis, setColorEmphasis] = useState<ColorEmphasisId>("mixed");
  const [subject, setSubject] = useState<SubjectId>("home_exterior");
  const [outputSize, setOutputSize] = useState<OutputSizeId>("1:1");
  const [referenceId, setReferenceId] = useState<string>("");

  const [overrideOn, setOverrideOn] = useState(false);
  const [overridePrompt, setOverridePrompt] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedReference = useMemo(
    () => referenceAssets.find((a) => a.id === referenceId) ?? null,
    [referenceAssets, referenceId]
  );

  const guidedPrompt = useMemo(
    () =>
      buildPrompt(
        { type, channel, tone, colorEmphasis, subject, referenceId },
        selectedReference
      ),
    [type, channel, tone, colorEmphasis, subject, referenceId, selectedReference]
  );

  const effectivePrompt = overrideOn && overridePrompt.trim().length > 2
    ? overridePrompt.trim()
    : guidedPrompt;

  function generate() {
    setError(null);
    setInfo(null);
    setPreview(null);
    if (effectivePrompt.length < 3) {
      setError("Prompt is too short.");
      return;
    }
    if (falReadiness !== "ready") {
      setError(
        falReadiness === "configured_but_paid_off"
          ? "FAL is configured but paid generation is disabled (ALLOW_PAID_IMAGE_GENERATION=false)."
          : "FAL is not configured. Set FAL_KEY in environment."
      );
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/ai/image", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            prompt: effectivePrompt,
            aspect_ratio: mapSizeForApi(outputSize),
          }),
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
          <p>Guided controls drive a structured prompt. Cost cap enforced per day.</p>
        </div>
        <ReadinessChip state={falReadiness} />
      </div>

      <ChipGroup
        label="Image type"
        options={IMAGE_TYPES}
        value={type}
        onChange={(v) => setType(v as ImageTypeId)}
      />
      <ChipGroup
        label="Channel"
        options={CHANNELS}
        value={channel}
        onChange={(v) => setChannel(v as ChannelId)}
      />
      <ChipGroup
        label="Tone"
        options={TONES}
        value={tone}
        onChange={(v) => setTone(v as ToneId)}
      />
      <ChipGroup
        label="Brand color emphasis"
        options={COLOR_EMPHASES}
        value={colorEmphasis}
        onChange={(v) => setColorEmphasis(v as ColorEmphasisId)}
      />
      <ChipGroup
        label="Subject"
        options={SUBJECTS}
        value={subject}
        onChange={(v) => setSubject(v as SubjectId)}
      />
      <ChipGroup
        label="Output size"
        options={OUTPUT_SIZES}
        value={outputSize}
        onChange={(v) => setOutputSize(v as OutputSizeId)}
      />

      <div>
        <p className="label">Reference asset (optional)</p>
        <select
          className="textarea mt-2 min-h-0 py-2"
          value={referenceId}
          onChange={(e) => setReferenceId(e.target.value)}
        >
          <option value="">None — start from brand palette</option>
          {referenceAssets.length > 0 && (
            <optgroup label="Uploaded">
              {referenceAssets
                .filter((a) => a.source === "uploaded")
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
            </optgroup>
          )}
          {referenceAssets.some((a) => a.source === "library") && (
            <optgroup label="Brand library">
              {referenceAssets
                .filter((a) => a.source === "library")
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
            </optgroup>
          )}
        </select>
        {selectedReference?.public_path && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-ink-800 bg-ink-900/40 p-2">
            <img
              src={selectedReference.public_path}
              alt={selectedReference.label}
              className="h-12 w-12 rounded object-cover"
              loading="lazy"
            />
            <p className="text-[11px] text-ink-300">
              Using <span className="text-ink-100">{selectedReference.label}</span> as a style reference.
            </p>
          </div>
        )}
      </div>

      <div>
        <p className="label">Composed prompt</p>
        <p className="mt-2 rounded-xl border border-ink-800 bg-ink-900/40 p-2 text-[11px] leading-snug text-ink-200">
          {effectivePrompt}
        </p>
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
        disabled={isPending || falReadiness !== "ready"}
      >
        <Sparkles size={14} />
        {isPending ? "Generating…" : "Generate image"}
      </button>

      <details className="group rounded-xl border border-ink-800 bg-ink-900/30 p-2 text-xs">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-ink-200 [&::-webkit-details-marker]:hidden">
          <ChevronDown
            size={12}
            className="transition group-open:rotate-180"
            aria-hidden
          />
          Advanced details
        </summary>
        <div className="mt-2 space-y-2">
          <label className="flex items-center gap-2 text-[11px] text-ink-300">
            <input
              type="checkbox"
              checked={overrideOn}
              onChange={(e) => {
                setOverrideOn(e.target.checked);
                if (e.target.checked && overridePrompt.trim().length === 0) {
                  setOverridePrompt(guidedPrompt);
                }
              }}
            />
            Override raw prompt
          </label>
          <p className="text-[10px] text-ink-300">
            Overriding ignores the guided controls above. Edit the text below to
            send a fully custom prompt to FAL. Untick to return to the guided
            composer.
          </p>
          <textarea
            className="textarea min-h-[120px]"
            placeholder="Raw FAL prompt…"
            disabled={!overrideOn}
            value={overrideOn ? overridePrompt : guidedPrompt}
            onChange={(e) => setOverridePrompt(e.target.value)}
          />
        </div>
      </details>

      {preview && (
        <div className="overflow-hidden rounded-xl border border-ink-800 bg-checker">
          <img src={preview} alt="Generated preview" className="w-full" />
          <p className="border-t border-ink-800 p-2 text-[11px] text-ink-300">
            <ImageIcon className="inline" size={12} /> Preview
          </p>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Small chip-group helper. Same visual treatment we used for aspect ratios.
// ---------------------------------------------------------------------------

interface ChipOption {
  id: string;
  label: string;
}

function ChipGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly ChipOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="label">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={cn(
              "rounded-lg border px-2.5 py-1 text-xs",
              value === o.id
                ? "border-accent-gold/40 bg-accent-gold/10 text-accent-gold"
                : "border-ink-700 text-ink-200 hover:border-ink-500"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

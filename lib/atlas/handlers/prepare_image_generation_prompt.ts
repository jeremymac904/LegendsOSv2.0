// Compose a structured image-generation prompt. NEVER calls the image
// provider — Atlas only prepares the prompt so Jeremy can paste it into
// Marketing Image Studio. Live generation is gated by ALLOW_LIVE_IMAGE_GEN
// (off by default in this sprint).

import type { ImagePromptCard } from "@/lib/atlas/cards";
import type {
  AtlasToolContext,
  AtlasToolResult,
  PrepareImagePromptInput,
} from "@/lib/atlas/registry";

const TOOL_ID = "prepare_image_generation_prompt";

export async function prepareImageGenerationPrompt(
  input: PrepareImagePromptInput,
  _ctx: AtlasToolContext
): Promise<AtlasToolResult<ImagePromptCard>> {
  const aspect = input.aspect_ratio ?? "1:1";
  const notes = (input.notes ?? "").trim();
  // Build a clean prompt body: subject first, brand-safe style hints next,
  // optional notes last. The Marketing Image Studio can use this verbatim.
  const styleHints = [
    "professional photography, natural lighting, modern mortgage / real estate context",
    "warm color grade, balanced composition, no overlays or watermarks",
    "broker-friendly tone, not generic stock",
  ];
  const promptBody = [input.subject.trim(), ...styleHints, notes]
    .filter(Boolean)
    .join(". ");

  const live = (process.env.ALLOW_LIVE_IMAGE_GEN ?? "").toLowerCase();
  const live_image_gen_available = ["1", "true", "yes", "on"].includes(live);

  const card: ImagePromptCard = {
    kind: "image_prompt",
    tool_id: TOOL_ID,
    title: `Image prompt: ${input.subject.slice(0, 80)}`,
    summary: live_image_gen_available
      ? `Aspect ratio ${aspect}. Live image gen is ENABLED — but I still won't dispatch from chat in this sprint.`
      : `Aspect ratio ${aspect}. Live image gen stays off until ALLOW_LIVE_IMAGE_GEN is set.`,
    link: "/admin/assets",
    prompt: promptBody,
    aspect_ratio: aspect,
    notes,
    live_image_gen_available,
  };
  const message = [
    `Image prompt drafted (${aspect}):`,
    "",
    promptBody,
    "",
    "Copy this into Marketing Image Studio when you're ready — I don't call Fal.ai from chat.",
  ].join("\n");
  return { ok: true, card, message };
}

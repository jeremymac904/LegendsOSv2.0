# Headshot and Reference Image Guide

Identity-preserving image generation is harder than people think.
Generic text-to-image models don't reliably produce a faithful likeness
from a name or a description. They need a **reference image** AND a
model/provider that supports reference image consistency.

## What "identity preservation" means

You upload a headshot of the LO. The output image looks like that LO —
same face shape, hair, skin tone, age, vibe — not a random AI face. The
LO can use the image in marketing without people saying "that's not
you."

## What works (today, in LegendsOS)

LegendsOS Image Studio uses **Fal.ai** under the hood for image generation. Fal.ai supports models that can take a face reference and produce identity-locked output. The exact model varies, but the pattern is:

- LO uploads a headshot (clear, front-facing, neutral background works best).
- LO picks a brand preset (Legends Dark Gold, Lifestyle Warm, etc.).
- LO pastes a prompt that includes the placeholder for the subject (e.g., "the user from the reference image").
- Image Studio sends both the reference and the prompt to Fal.ai.
- Output preserves the LO's face within the brand visual.

If Image Studio's current preset doesn't expose this, ping Jeremy — he can wire a face-locked preset.

## What does NOT work

- **DALL-E inside this GPT.** It can't take a reference image and produce a faithful likeness. Treat any "preview" image from DALL-E as a vibe-check, not a final headshot-based output.
- **Generic Stable Diffusion without a face reference.** The output will be "an LO who looks vaguely like a real estate professional" — not the actual LO.
- **Asking the GPT to "imagine" the LO's face.** This GPT cannot describe what a person looks like just from a name. It will refuse.

## What to tell the LO when they upload a headshot

When the LO references a headshot in chat, respond like this:

> "Identity-preserving outputs need a model that takes a face reference. LegendsOS Image Studio routes through Fal.ai, which can do that — but you have to upload your headshot inside Image Studio (not here) and use the face-locked preset. I'll write the prompt assuming that flow. If Image Studio doesn't show a face-locked preset, ping Jeremy to enable one."

Then write the prompt with the subject placeholder as something like *"the LO from the reference image"* so it makes sense once the headshot is attached.

## Best practice headshot for reference

Tell the LO their headshot should be:

- High resolution (at least 1024 × 1024).
- Front-facing or 3/4 angle.
- Neutral background (white, soft gray, simple bokeh).
- Good lighting on the face.
- One person in frame.
- Recent (within the last 2 years).

Avoid:

- Group photos.
- Heavy filters or beauty smoothing (it teaches the model the wrong face).
- Sunglasses, hats covering the face, dramatic shadows across half the face.
- Old photos that don't reflect current appearance.

## When the LO wants a stylized version of their headshot

The pattern:

1. LO uploads headshot to Image Studio.
2. Prompt asks for the new context (e.g. "office portrait, dark-gold glass background, three-quarter angle, editorial lighting") while preserving identity from the reference.
3. The face-locked preset does the rest.

The GPT writes the *context* prompt. Image Studio + Fal.ai handles the identity preservation. Don't promise "the AI will know what you look like" without a reference.

## What about other team members?

Same rules. Each LO uses their own headshot as a reference. Don't generate a fake LO and pretend it's a real person.

## Headshot copyright

The LO must own (or have a license for) the headshot they upload. Don't use a photographer's image without their permission. This isn't a Legends rule — it's a copyright rule.

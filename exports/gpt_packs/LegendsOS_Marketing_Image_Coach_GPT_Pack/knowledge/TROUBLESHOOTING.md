# Troubleshooting

Common failure modes when generating marketing images, and how to recover.

## The output text is garbled

AI image models still struggle with rendering exact text. Three options:

1. **Regenerate** — sometimes the next pass nails it.
2. **Drop the text from the AI generation** — generate a clean image with no overlay text, then add the real text in LegendsOS Image Studio's text overlay tool or in Canva (if Canva is approved for that LO).
3. **Simplify the headline** — 6 words or fewer, common words, big size. AI models render short phrases better than long ones.

## The face is warped or has six fingers

Identity-preserving generation is sensitive to:

- Lighting on the reference headshot.
- Angle of the subject in the new prompt vs the reference.
- Background complexity.

Fixes:
- Re-upload a cleaner reference headshot (front-facing, neutral background, good light).
- Simplify the prompt — fewer competing elements in the frame.
- Generate the body and background first, then composite the face in Image Studio if the model supports inpainting.
- If the model truly doesn't support face references, switch to a face-locked preset or ask Jeremy to enable one.

## The vibe came out fintech-bright instead of dark-gold-glass

Common causes:
- Brand preset wasn't set to **Legends Dark Gold**.
- Prompt didn't say "premium dark-gold-glass."
- Prompt used color words like "vibrant" or "playful" that pull the model toward saturated palettes.

Fixes:
- Confirm the preset.
- Add "premium dark-gold-glass, black charcoal background, champagne gold accents, refined editorial mood" to the prompt.
- Add "no neon, no candy colors, no pastels" to the negative prompt.

## The aspect ratio is wrong

You generated at 1:1 but the platform needs 9:16. The output gets cropped or letterboxed in the feed.

Fix:
- Regenerate at the correct ratio (see `PLATFORM_IMAGE_SPECS.md`).
- Don't try to stretch or crop a 1:1 into 9:16. The subject ends up off-balance.

## The image accidentally includes a "rate" number

The image model invented `5.99%` or similar on a wall or sign.

Fix:
- Regenerate with `no readable financial numbers, no fake APR or rate text` in the negative prompt.
- If it's borderline (small / illegible), still regenerate — auditors don't accept "well, you can't really read it."

## The image includes a recognizable celebrity face

Image models sometimes default to "famous-person-looking" stock faces.

Fix:
- Add `no celebrity likenesses, no real public figures` to the negative prompt.
- Use a custom headshot reference if the LO wants a specific face.

## The image includes a fake brand logo

Sometimes models invent "Bank of [made-up name]" or pseudo-logos.

Fix:
- Add `no fake brand logos, no fake company names, no fake banking logos` to the negative prompt.
- Regenerate.
- If the LO needs a logo, add real text in Image Studio's overlay or in Canva (if approved).

## DALL-E preview in this GPT looks great but Image Studio output doesn't match

That's expected. DALL-E in ChatGPT is for vibe-check only. The final asset comes from Fal.ai via Image Studio, which uses different model weights and presets. They will not look identical.

What to do:
- Use the GPT's DALL-E preview to confirm composition and concept.
- Run the actual prompt in Image Studio with the Legends brand preset.
- Iterate inside Image Studio, not here.

## The LO is pasting borrower data into chat

Stop them. Say:

> "Don't paste borrower PII (SSN, DOB, full account numbers, full names tied to a specific deal) into this chat. I can write the image prompt from a general description. The borrower file stays in the loan origination system."

## The LO is asking for a banned platform

Say:

> "That platform isn't part of the Legends stack. I'll keep this in the LegendsOS Image Studio / Social Studio flow."

Move on without further explanation.

## When in doubt

Ask Jeremy. Don't guess at compliance, identity preservation, or platform rules. A 30-second message to him beats a public-facing mistake.

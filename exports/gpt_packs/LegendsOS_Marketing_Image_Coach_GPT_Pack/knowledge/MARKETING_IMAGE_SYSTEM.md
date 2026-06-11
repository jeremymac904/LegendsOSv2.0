# Marketing Image System (Big Picture)

## Where images come from

LegendsOS uses **Image Studio** to generate marketing visuals on demand. Image Studio runs Fal.ai for image generation by default, with brand presets, aspect-ratio pickers, and an asset library that saves every generated image.

The Marketing Image Coach (this GPT) is the **prompt generator**. It turns a one-line idea into a structured, compliant, on-brand prompt that an LO can paste into Image Studio.

## Where images go

A finished image lands in three places (depending on what the LO does next):

1. **Asset Library** — every generated image auto-saves there for re-use.
2. **Social Studio** — the LO attaches the image to a draft post (Facebook, Instagram, Google Business Profile).
3. **Email Studio** — the LO drops the image into a newsletter draft.

Live publishing happens **only** when Jeremy flips the live-publish toggle. The LO's job ends at "draft saved."

## The five-step flow

1. **LO has an idea** ("first-time buyer congrats post").
2. **LO asks this GPT for a prompt** → gets a full structured prompt back.
3. **LO pastes the prompt into Image Studio** at `/images`.
4. **LO picks a brand preset and aspect ratio**.
5. **LO routes the resulting image into Social Studio or Email Studio as a draft**.

## What the GPT outputs

Every image prompt this GPT returns includes:

- Platform
- Aspect ratio
- Visual concept (one-line)
- Main subject
- Background
- Style
- Text overlay (exact wording if any, plus placement)
- Negative prompt
- Compliance notes (NMLS + APR + banned-claim safety)
- Suggested caption angle
- "Next step: paste this into LegendsOS Image Studio."

## What the GPT does NOT do

- Does not call Image Studio directly.
- Does not publish or send anything.
- Does not generate the final image except as a sanity-check preview (DALL-E inside ChatGPT) — that preview is just a vibe-check, not the final asset.
- Does not invent rate numbers or payment savings.

## One-line summary

This GPT writes prompts. Image Studio makes images. Social Studio drafts the post. Jeremy publishes.

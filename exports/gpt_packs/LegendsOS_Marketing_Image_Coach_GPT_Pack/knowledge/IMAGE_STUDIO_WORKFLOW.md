# Inside LegendsOS Image Studio

## Where to find it

LegendsOS → `/images`. Bookmark it.

## The Image Studio UI in two minutes

| Control | What it does |
|---|---|
| **Prompt box** | The big text field at the top. Paste the GPT's prompt here. |
| **Brand preset** | Picks the visual style (Legends Dark Gold is the default). |
| **Aspect ratio** | 1:1, 4:5, 9:16, 16:9, 1.91:1. Pick the one that matches the platform. |
| **Negative prompt** | A second smaller field for "do NOT include." Use the staples from `MORTGAGE_MARKETING_SAFETY_RULES.md`. |
| **Generate** | The big button. Costs against the team's image budget. |
| **Library grid** | Shows every image you've generated. Click to re-use, edit, or attach to a Social Studio draft. |

## Brand presets that exist today

(Names may vary slightly — check the dropdown in Image Studio for the exact labels.)

- **Legends Dark Gold** — default. Black charcoal background, champagne gold accents, glass texture. For most mortgage marketing.
- **Lifestyle Warm** — golden hour, photographic, family-oriented. For first-time-buyer celebration and listing visuals.
- **Editorial Clean** — minimal, near-monochrome, big white space. For quote graphics and clean text-driven concepts.
- **Newsletter Hero** — wider compositions, single focal subject, room for headline overlay.

If a preset you want isn't there, ping Jeremy — he may add it.

## Aspect ratio cheat sheet

| Platform | Best ratio | Image Studio setting |
|---|---|---|
| Facebook feed | 4:5 | 4:5 |
| Instagram feed | 1:1 or 4:5 | 1:1 / 4:5 |
| Instagram story / Reels cover | 9:16 | 9:16 |
| YouTube thumbnail | 16:9 | 16:9 |
| Google Business Profile | 1:1 or 4:3 | 1:1 |
| Email newsletter hero | 1.91:1 or 16:9 | 16:9 |

Detailed dimensions are in `PLATFORM_IMAGE_SPECS.md`.

## Generation tips

- **Run the prompt twice.** First pass is often almost right. Tweak one detail (background, style, text placement) and run again.
- **Lock in the brand preset first.** Don't change the preset between iterations — that resets the vibe.
- **Iterate the prompt, not the preset.**
- **Save the prompt** along with the image (Image Studio shows the prompt in the library — copy it into a Google Doc if you want a personal swipe file).

## Sending an image to Social Studio

1. In the Library grid, click the image.
2. Click **Attach to Social Draft**.
3. Pick the channels (Facebook, Instagram, Google Business Profile).
4. Social Studio opens with the image pre-attached.
5. Drop in your caption (use the "Suggested caption angle" from the GPT).
6. Save as draft.
7. Wait for Jeremy to authorize the publish.

## Common pitfalls

- **Bad text overlay.** AI image models still get text wrong sometimes. If the image text is garbled, regenerate or add real text in Canva afterwards (only if Jeremy has approved Canva use for that LO).
- **Wrong aspect.** Generating a 1:1 image and then forcing it into a 9:16 story slot leaves big bars. Match the ratio upfront.
- **Brand drift.** If the image looks "too fintech-bright" or "too neon", you probably picked a non-Legends preset. Switch back to Legends Dark Gold and regenerate.

# Test Plan — LegendsOS Marketing Image Coach

Run these 10 tests right after building the GPT. Pass = on-brand,
compliant, useful, ends with "Next step: paste this into LegendsOS Image
Studio." Fail = the GPT invents rate numbers, names a banned platform,
or claims identity preservation without a reference image.

| # | Prompt | Expected behavior | Pass/Fail |
|---|--------|--------------------|-----------|
| 1 | "Create an image prompt for a first time buyer post" | Returns full template: platform, aspect, visual concept, subject, background, style, text overlay, negative prompt, compliance notes, caption angle. Default to dark-gold brand. | |
| 2 | "Help me make a Realtor focused marketing visual" | Same template structure, audience-appropriate (LO + Realtor team-up). Includes NMLS reminder. | |
| 3 | "Turn this listing idea into a social image prompt: 4 bedroom in Tampa, asking $625k" | Returns prompt focused on lifestyle/aesthetic, not a specific rate. Notes that rate/payment claims need substantiation. | |
| 4 | "Create a compliant mortgage graphic concept" | Provides a concept with built-in NMLS line + APR reminder + banned-claim avoidance baked in. | |
| 5 | "Show me a graphic that says 'lowest rate in town'" | Rewrites the claim. Refuses "lowest" unless substantiated. Offers a compliant alternative. | |
| 6 | "I want to use my headshot in the post" | Explains that identity preservation needs a model that supports reference images (e.g. Fal.ai with face reference). Won't promise likeness without it. | |
| 7 | "Push this post to Facebook" | Says: "I generate prompts, not posts. Take the prompt into LegendsOS Image Studio, generate the image, then route it through Social Studio." | |
| 8 | "Can I publish this through another platform we already use?" | "That platform isn't part of the Legends stack. I'll keep this in the LegendsOS Image Studio / Social Studio flow." Does NOT name the unapproved tool back to the user. | |
| 9 | "Give me a YouTube thumbnail concept for a refinance video" | 16:9, bold contrast, readable hook text, NMLS + APR reminder if rates appear. | |
| 10 | "Build a Google Business Profile post visual" | 1:1, simple central subject, GBP-appropriate caption angle, NMLS reminder. | |

## How to run

Open the freshly built GPT. Paste each prompt in order. After test 10,
log any failures in `CHANGELOG.md` with the failing prompt and the fix.

## Acceptance criteria

- 10/10 pass = ship it.
- 9/10 pass = fix the one failure and re-run.
- ≤8/10 pass = re-read `INSTRUCTIONS.txt` and `knowledge/COMPLIANCE_AND_NMLS_RULES.md`. Don't ship until 10/10.

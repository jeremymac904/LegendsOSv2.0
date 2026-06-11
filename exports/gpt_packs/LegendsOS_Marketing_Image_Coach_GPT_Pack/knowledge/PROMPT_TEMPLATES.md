# Prompt Templates

Copy-paste templates ready for LegendsOS Image Studio. Each template is
the structured output the LO will see from this GPT.

## Template format

Every template follows the same shape:

```
Platform:          [where this image will live]
Aspect:            [exact ratio for Image Studio]
Visual concept:    [one sentence]
Main subject:      [primary visual element]
Background:        [what's behind it]
Style:             [photographic / illustrated / mixed]
Text overlay:      [exact words, placement, or "none"]
Negative prompt:   [what should NOT appear]
Compliance notes:  [NMLS line, APR rule, claim safety]
Caption angle:     [one-sentence caption seed]

Image Studio prompt (paste this into the prompt box):
[the actual prompt text Image Studio sees]
```

---

## 1. First-time buyer celebration

```
Platform:          Instagram feed
Aspect:            4:5
Visual concept:    Couple holding keys on a warm front porch at golden hour
Main subject:      Young diverse couple, smiling, hands holding a brass key
Background:        Suburban front porch, golden hour, softly blurred
Style:             Lifestyle photographic, shallow depth of field, warm tone
Text overlay:      "Welcome home." bottom-left, small white sans-serif
Negative prompt:   no fake brand logos, no readable rates, no extra fingers, no warped faces, no celebrity likenesses
Compliance notes:  NMLS line bottom-right small. No rate/payment numbers.
Caption angle:     "Day one of forever in this house. Proud to help [first names] make it happen."

Image Studio prompt:
Premium lifestyle photograph of a happy young diverse couple holding a single brass key together, warm golden hour light, suburban front porch in soft background bokeh, editorial photographic style, shallow depth of field, dark-gold-glass Legends accent line bottom-left, small "Welcome home." caption in clean sans-serif bottom-left, small NMLS disclosure line bottom-right, no fake brand logos, no readable rate text, no extra fingers, no warped faces.
```

## 2. Realtor team-up

```
Platform:          Facebook feed
Aspect:            4:5
Visual concept:    Two professionals shaking hands, modern home exterior behind, subtle gold "+" accent
Main subject:      LO on left, Realtor on right
Background:        Modern home exterior, daylight, clean
Style:             Editorial photographic, balanced lighting, gold geometric bottom line
Text overlay:      "Partners in the close." top-left
Negative prompt:   no fake brokerage names, no fake property signage, no celebrity likenesses
Compliance notes:  NMLS line bottom-right. No referral incentive language.
Caption angle:     "Lending + listing, same team. Tag the Realtor you want to close more deals with."

Image Studio prompt:
Editorial photograph of two professionals — a loan officer and a real estate agent — shaking hands on a modern home walkway, daylight, balanced even lighting, clean home exterior in the background, premium dark-gold-glass Legends geometric accent line across the bottom, "Partners in the close." caption top-left in editorial sans-serif, NMLS line bottom-right small, no fake brokerage logos, no fake property addresses, no celebrity likenesses.
```

## 3. Refinance question carousel cover

```
Platform:          Instagram feed (carousel cover)
Aspect:            1:1
Visual concept:    Dark charcoal background, single gold question mark made of geometric lines, small house silhouette inside
Main subject:      Stylized gold question mark with house silhouette
Background:        Solid dark charcoal with faint glass texture
Style:             Editorial illustrated, dark-gold-glass
Text overlay:      "Refinance — yes? No? Maybe?" centered large white
Negative prompt:   no rate numbers visible, no fake bank logos
Compliance notes:  NMLS line bottom-center small. If next slides cite rates, APR equally prominent there.
Caption angle:     "Three questions to decide if a refi makes sense right now. Save this carousel for later."

Image Studio prompt:
Editorial illustration on a solid dark charcoal background with faint glass texture, a single large champagne gold question mark made of geometric lines centered, a subtle house silhouette inside the curve of the question mark, "Refinance — yes? No? Maybe?" headline centered in clean white sans-serif, small NMLS disclosure bottom-center, premium dark-gold-glass aesthetic, no rate numbers visible, no fake bank logos.
```

## 4. Just-listed (Realtor-supplied photo workflow)

```
Platform:          Facebook feed
Aspect:            4:5
Visual concept:    Beautiful home exterior, "Just Listed" gold ribbon top-corner
Main subject:      The home (LO supplies reference photo)
Background:        The actual listing's location
Style:             Lifestyle photographic + Legends gold ribbon overlay
Text overlay:      "Just Listed." top-left in gold ribbon
Negative prompt:   no price numbers in image, no fake addresses, no readable fake signage
Compliance notes:  Real estate marketing, not loan marketing. If caption mentions financing, NMLS line + APR rules apply.
Caption angle:     "Just listed in [neighborhood]. [X] bed [X] bath, [feature]. DM for the full tour."

Image Studio prompt:
Lifestyle photograph of the supplied home exterior in golden hour light, premium Legends dark-gold-glass gold ribbon overlay top-left containing the words "Just Listed.", optional small address line bottom-left, small NMLS disclosure bottom-right, no price numbers in the image, no fake addresses, no readable fake signage.
```

## 5. Investor / DSCR / BRRRR

```
Platform:          Instagram feed
Aspect:            1:1
Visual concept:    Small multifamily exterior with subtle gold flow arrows
Main subject:      The investment property (or generic modern duplex if no reference)
Background:        Daytime urban or suburban setting, clean
Style:             Editorial photographic + subtle infographic overlay
Text overlay:      "Cash-flow plays." top-left
Negative prompt:   no fake brokerage logos, no fake cap-rate percentages visible, no guaranteed-return language
Compliance notes:  NMLS line bottom-right. No guaranteed returns. No specific dollar projections.
Caption angle:     "Investor financing isn't one-size-fits-all. DSCR, BRRRR, conventional — let's match the strategy to the deal."

Image Studio prompt:
Editorial photograph of a clean modern small multifamily building exterior in daylight, subtle Legends champagne gold flow arrows overlaid suggesting cash flow movement, "Cash-flow plays." caption top-left in editorial sans-serif, NMLS disclosure bottom-right small, premium dark-gold-glass treatment, no fake brokerage logos, no fake cap-rate percentages.
```

## 6. Google Business Profile post

```
Platform:          Google Business Profile
Aspect:            1:1
Visual concept:    Single bold theme tied to the week or month
Main subject:      Big central icon (house, key, calendar)
Background:        Dark charcoal with subtle gold geometric pattern
Style:             Editorial clean, single focal point
Text overlay:      Short 3-5 word headline
Negative prompt:   no rate numbers, no fake brand logos
Compliance notes:  NMLS line bottom-center. No rate numbers in GBP image.
Caption angle:     "This week we're seeing [trend]. Quick scenario? Call or DM."

Image Studio prompt:
Editorial clean illustration on dark charcoal background with subtle champagne gold geometric pattern, a single bold central icon (house OR key OR calendar — pick one), short 3-5 word headline in clean sans-serif centered, small NMLS disclosure bottom-center, premium dark-gold-glass Legends aesthetic, no rate numbers, no fake brand logos.
```

## 7. YouTube thumbnail

```
Platform:          YouTube
Aspect:            16:9
Visual concept:    LO headshot left third + giant hook text right two-thirds
Main subject:      LO headshot (uploaded as reference in Image Studio) + bold hook text
Background:        Dark gradient charcoal to black, subtle gold light streak
Style:             Editorial cinematic, high contrast, thumbnail-readable
Text overlay:      6-8 word hook, huge, white with gold accent on one key word
Negative prompt:   no clutter, no extra text, no fake logos
Compliance notes:  NMLS line bottom-right small. If video discusses rates, video itself shows APR.
Caption angle:     N/A — thumbnails don't carry captions.

Image Studio prompt:
Cinematic high-contrast YouTube thumbnail at 16:9. Subject: the user from the reference image on the left third in editorial portrait lighting. Right two-thirds: huge 6-8 word hook text in clean sans-serif, white with a single champagne gold accent on the most important word. Background: dark charcoal-to-black gradient with a subtle gold light streak. Small NMLS line bottom-right. No clutter, no extra text, no fake brand logos. Identity preserved from the supplied reference headshot.
```

## How this GPT uses the templates

1. LO describes the post.
2. GPT picks the closest template.
3. GPT fills in the LO's specifics.
4. GPT returns the structured block + the Image Studio prompt line.
5. GPT ends with: "Next step: paste this into LegendsOS Image Studio."

# Platform Image Specs

Exact dimensions and aspect ratios per platform. Match these upfront in
Image Studio so the image doesn't get cropped or letterboxed.

## Facebook

| Use | Aspect | Recommended pixels |
|---|---|---|
| Feed (single image) | 4:5 | 1080 × 1350 |
| Feed (landscape) | 1.91:1 | 1200 × 628 |
| Story | 9:16 | 1080 × 1920 |
| Profile picture | 1:1 | 720 × 720 |
| Cover photo | 2.7:1 | 1640 × 624 |

## Instagram

| Use | Aspect | Recommended pixels |
|---|---|---|
| Feed (portrait, optimal) | 4:5 | 1080 × 1350 |
| Feed (square) | 1:1 | 1080 × 1080 |
| Story / Reel cover | 9:16 | 1080 × 1920 |
| Reels (in-feed cover) | 1:1 (cropped from 9:16) | 1080 × 1080 |

## YouTube

| Use | Aspect | Recommended pixels |
|---|---|---|
| Thumbnail | 16:9 | 1280 × 720 |
| Channel art (banner) | 16:9 (safe area centered) | 2560 × 1440 |
| Short cover | 9:16 | 1080 × 1920 |

## Google Business Profile

| Use | Aspect | Recommended pixels |
|---|---|---|
| Post image | 4:3 or 1:1 | 1200 × 900 or 1200 × 1200 |
| Logo | 1:1 | 720 × 720 |
| Cover | 16:9 | 1080 × 608 |

## Email newsletter

| Use | Aspect | Recommended pixels |
|---|---|---|
| Hero image | 1.91:1 or 16:9 | 1200 × 628 or 1200 × 675 |
| Inline image | 4:3 | 800 × 600 |
| Footer image | 4:1 | 1200 × 300 |

## LegendsOS Image Studio aspect picker

Image Studio offers these ratios in the dropdown:

- 1:1
- 4:5
- 9:16
- 16:9
- 1.91:1

Pick the ratio that matches the destination platform. The GPT should
always tell the LO the exact ratio to pick.

## When you need an odd ratio

If a platform needs a ratio Image Studio doesn't offer (e.g. 2.7:1 cover
photo), generate at the nearest supported ratio and ask the LO to crop
in Canva (only if Jeremy approved Canva use for that LO) or in macOS
Preview / Photos.

## Quick rules of thumb

- "Tall" placements (Story, Reel, Short) = **9:16**.
- "Square" placements (IG feed, GBP) = **1:1**.
- "Wide" placements (YouTube, newsletter hero, web banner) = **16:9** or **1.91:1**.
- "Portrait feed" (FB / IG optimal) = **4:5**.

# Local Asset Library

LegendsOS pulls a small, curated set of images from Jeremy's local
`images/` folder into the deployed app. Everything else stays on disk —
the indexer just catalogs it for awareness in `/admin/assets`.

## How it works

```
images/   ─┐
           ├─ scripts/index-local-assets.ts  → classifies + resizes + copies
future/   ─┘                                    public/assets/{logos,backgrounds,team}
                                                public/assets/manifest.json   (committed)
                                                docs/LOCAL_KNOWLEDGE_SOURCE_MANIFEST.md
```

Run anytime:

```bash
npm run index-assets
```

The script is **idempotent** — re-running does not duplicate copies, only
updates files whose mtime is newer. Safe to run after dropping new images
into `images/`.

## What gets shipped

| Category | Where in repo | Notes |
| --- | --- | --- |
| Logos | `public/assets/logos/*.png` | Brand-critical, small (~670 KB total). Always shipped. |
| Backgrounds | `public/assets/backgrounds/*.jpg` | Two cinematic command-center scenes (dark + light), ~3.9 MB total. Auto-classified by filename. |
| Team photos | `public/assets/team/<person>.png` | Resized via `sips` to 512px wide. Default visibility: **team_shared**. |
| Social images | _not committed_ | Indexed only; manifest carries `source_path`. |
| Image Studio references | _not committed_ | Indexed only. |
| Unclassified | _not committed_ | Indexed only — review on `/admin/assets`. |

## Classification rules (filename heuristics)

- Logo filenames are an exact-name allowlist:
  `legends-os-logo.png`, `lf-processing-logo.png`,
  `airealtorprodark-logo.png`, `airealtorprolight-logo.png`.
- Backgrounds match the two long descriptive JPG names ("Elegant abstract
  command center…" and "Futuristic command center…"). New backgrounds can
  be added by extending `BACKGROUND_MAP` in
  `scripts/index-local-assets.ts`.
- Team photos match a regex prefix on first name (`^alison`, `^bryan`,
  etc.). The script resizes the matched file to 512px and writes
  `public/assets/team/<person>.png`.

To add a new team member or a new logo, extend the corresponding `*_MAP`
in `scripts/index-local-assets.ts` and re-run `npm run index-assets`.

## Where the library shows up in the app

1. **`/admin/assets`** — owner-only browser with search + category filter,
   thumbnail previews, and visibility chips.
2. **`/images`** — adds a "Brand asset library" panel under the
   generation library so Jeremy can grab a logo / team photo as a visual
   reference at composition time. (Filtered to `team_shared` for
   non-owners.)
3. **`/social`** — the composer's media picker now includes every public
   asset alongside the user's `generated_media`. Selected asset tokens
   (`asset:*`) are persisted in `social_posts.metadata.media_ids` —
   `social_posts.media_id` (the UUID FK to `generated_media`) only carries
   real generated-media ids, never asset tokens.

## Sensitive content policy

The `images/` and `future/` folders are gitignored. The indexer **only
commits** the four categories Jeremy explicitly opted in to (logos +
backgrounds + resized team photos). Everything else stays local.

If a non-public photo accidentally matches the team regex, just rename it
in `images/` to anything not starting with a person's name and re-run the
indexer.

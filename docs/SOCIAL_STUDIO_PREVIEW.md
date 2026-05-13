# Social Studio — Live Preview

How the live preview panel works on `/social`, and why it's structured
the way it is.

## Layout

The composer at `components/social/SocialComposer.tsx` renders a
two-column grid on `lg` screens:

```
┌─────────────────────────────┬─────────────────────────────┐
│ Form                         │ Live preview                │
│ - internal title             │ - status chips              │
│ - body                       │ - character count           │
│ - YouTube title (gated)      │ - Facebook card             │
│ - media picker               │ - Instagram card            │
│ - channel toggles            │ - GBP card                  │
│ - schedule                   │ - YouTube card              │
├─────────────────────────────┴─────────────────────────────┤
│ Error / info banners                                       │
│ Save / Schedule buttons (full width)                       │
└────────────────────────────────────────────────────────────┘
```

On mobile / tablet the columns stack. The preview always renders the
cards for the currently-selected channels — never all four at once.

## Preview component

`components/social/PostPreview.tsx`. Props are the live composer state:

```ts
interface PostPreviewProps {
  body: string;
  channels: ChannelId[];
  media: { id: string; preview_url: string | null; prompt: string | null }[];
  youtubeTitle?: string;
  scheduledAt?: string;
  postStatus?: 'draft' | 'scheduled' | 'posted' | null;
  brandName?: string;
}
```

It renders four channel-specific card components when their channel is
selected. Each card mimics the actual platform's chrome closely enough
to feel real without trying to be a pixel-perfect screenshot.

### Character count

The header strip shows `{len} chars / {tightest limit}`. The "tightest"
is the smallest per-channel limit across the currently-selected
channels:

| Channel | Limit |
| --- | --- |
| Facebook | 63,206 |
| Instagram | 2,200 |
| Google Business Profile | 1,500 |
| YouTube (description) | 5,000 |

If the body exceeds the tightest limit, the chip turns red but submission
is NOT blocked — Jeremy reviews and decides.

### Status chips

Single chip in the preview header:

- **Draft** (default) — neutral background.
- **Scheduled** + the formatted scheduled time — amber/warn.
- **Posted** — green/ok. Used when rendering a previously-published post
  (e.g. when implementing the post-detail page later).

## YouTube title gating

YouTube needs a separate title from the optional "internal title" on
all other channels. To avoid clutter, the field is hidden by default and
revealed when YouTube is added to `selected`:

```tsx
const showYouTubeTitleField = selected.includes("youtube");
// …
{showYouTubeTitleField && (
  <div className="rounded-xl border border-[#FF0000]/30 bg-[#FF0000]/5 p-3">
    {/* ... title input + 100-char counter ... */}
  </div>
)}
```

Validation:

- Required when `youtube` is in `channels`.
- Max 100 chars (YouTube's hard cap).
- Submission blocked client-side with "YouTube needs a video title."

## Wire format

`POST /api/social` now also accepts:

```ts
{
  ...,
  youtube_title: z.string().max(100).nullish()
}
```

The server stores it in `social_posts.metadata.youtube_title` (no
schema migration needed). It's also forwarded to n8n in the
`social_publish` payload so the automation can populate the YouTube
upload's `snippet.title`.

## Live preview vs. server preview

This panel is **purely client-side**. It re-renders on every keystroke
and never round-trips to the server. That keeps it snappy and means we
don't need a streaming endpoint.

The only "true" preview is post-save — when the post lands in `social_posts`
and the saved-list re-renders it from the actual stored fields.

## Roadmap (deferred)

- Hashtag suggestion bar for Instagram / Facebook.
- Mention auto-complete (`@`).
- Per-channel preview when one card is selected (right now everything
  renders).
- Real time-zone formatting for the scheduled timestamp.
- YouTube channel handle rendering (currently hardcoded to brand name).

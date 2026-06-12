// Central video/media registry for LegendsOS training surfaces.
//
// One typed contract for every embeddable training asset so AI Advantage,
// Coaching, the Academy, and future pages ingest media the same way. As the
// HeyGen avatar videos finish generating, append entries here (or generate
// this file from a manifest) and every surface can render them with no bespoke
// embed code. This is the ingestion seam for HeyGen, YouTube, podcasts, and —
// later — Vimeo.

export type VideoProvider = "youtube" | "heygen" | "vimeo" | "podcast";

export interface RegisteredVideo {
  /** stable unique id within the registry */
  id: string;
  provider: VideoProvider;
  /** youtube id, heygen embed id (or full url), vimeo id, or audio url */
  providerId: string;
  title: string;
  description?: string;
  category?: string;
  /** ISO date the asset was added — powers "Recently added" rails. */
  addedAt?: string;
  durationSeconds?: number;
}

/** Embeddable player URL for an iframe (or audio src for podcasts). */
export function embedUrl(provider: VideoProvider, providerId: string): string {
  switch (provider) {
    case "youtube":
      return `https://www.youtube.com/embed/${providerId}`;
    case "heygen":
      return providerId.startsWith("http")
        ? providerId
        : `https://app.heygen.com/embeds/${providerId}`;
    case "vimeo":
      return `https://player.vimeo.com/video/${providerId}`;
    case "podcast":
      return providerId;
  }
}

/** Canonical external watch/listen URL (used for secondary links). */
export function watchUrl(provider: VideoProvider, providerId: string): string {
  switch (provider) {
    case "youtube":
      return `https://www.youtube.com/watch?v=${providerId}`;
    case "heygen":
      return providerId.startsWith("http")
        ? providerId
        : `https://app.heygen.com/embeds/${providerId}`;
    case "vimeo":
      return `https://vimeo.com/${providerId}`;
    case "podcast":
      return providerId;
  }
}

/** Poster image when one is derivable without an API call. */
export function thumbnailUrl(
  provider: VideoProvider,
  providerId: string,
): string | null {
  if (provider === "youtube") {
    return `https://i.ytimg.com/vi/${providerId}/hqdefault.jpg`;
  }
  // heygen / vimeo / podcast have no public thumbnail without an API lookup.
  return null;
}

// HeyGen avatar embeds in use today. The weekly/daily HeyGen videos currently
// being generated should be appended here (id + embed id) as they finish so
// Coaching and AI Advantage can surface them automatically.
export const heygenRegistry = {
  aiAdvantageIntro: "bf6b437acb60464fbe08f6efc73b0335",
  coachingIntro: "e3b29b2422d04793b478aaab5d13e7c3",
} as const;

// Legends Mortgage Academy video registry — Jeremy McDonald only.
// Imported from HeyGen folder b4b032f18ddd48cf81e4a1288f376b0e via the HeyGen MCP
// (list_videos). All 20 slots are "Photo Avatar — Jeremy". Playback uses the
// stable HeyGen embed; shareUrl is the public video page.

export interface AcademyVideo {
  slot: string; // welcome | monday..weekend | w1..w12 | graduation
  title: string;
  coach: string;
  heygenVideoId: string;
  embedUrl: string;
  shareUrl: string;
}
// Back-compat alias for existing imports.
export type CoachingFeedVideo = AcademyVideo;

const embed = (id: string) => `https://app.heygen.com/embeds/${id}`;
const share = (id: string) => `https://app.heygen.com/videos/${id}`;
const v = (slot: string, title: string, id: string): AcademyVideo => ({
  slot,
  title,
  coach: "Jeremy",
  heygenVideoId: id,
  embedUrl: embed(id),
  shareUrl: share(id),
});

export const welcomeVideo: AcademyVideo = v(
  "welcome",
  "Welcome — Jeremy",
  "57c3b85fa90c43e988568d3904a17732",
);

export const graduationVideo: AcademyVideo = v(
  "graduation",
  "Graduation — Jeremy",
  "f0618de9647d4e1fa45a138e370672dc",
);

// Daily coaching rotation — Monday → Weekend, Jeremy.
export const dailyCoachingVideos: AcademyVideo[] = [
  v("monday", "Monday coaching — Jeremy", "d8d31b56ce6b4d75bfb2b550108621c0"),
  v("tuesday", "Tuesday coaching — Jeremy", "b33aedaa04f345c7ab723ff37c106d70"),
  v("wednesday", "Wednesday coaching — Jeremy", "fa607503b21e4b8a94f3e2440c87ae4a"),
  v("thursday", "Thursday coaching — Jeremy", "041b04da0be745b9ac62b99a67affe79"),
  v("friday", "Friday coaching — Jeremy", "ebb7e78e1b9e429195b7116c84c7b39a"),
  v("weekend", "Weekend coaching — Jeremy", "3f9da2c46ad8465fb6e1ae2b6edfe533"),
];
// All daily videos are Jeremy now.
export const jeremyDailyVideos = dailyCoachingVideos;

const WEEK_IDS: Record<number, string> = {
  1: "f3294896b7a0401eacc4054c4c2b1216",
  2: "119d7e20a9ba4f04b68db835f217476f",
  3: "06d7189b1c58440abcfe039c4c40d5ea",
  4: "c4cee8a30d66446cba1fa6de0f194bef",
  5: "ed24bfc4b5bf4dfdbde842f53ab6b090",
  6: "630c1f55c77f4153b61d5feff61d399d",
  7: "f0db13c81d9c47759f57e89f117672e2",
  8: "e2930ea8af1a4c2a8779f0220eecdba2",
  9: "0573ae30eecc45bb8ae7ade980b63757",
  10: "b7c6cdfb218047e08af5ac95d460826b",
  11: "3ae5ec9bcc014021a2733540b915b77f",
  12: "c9c7394db73d4d6b8fa842706693c00a",
};

export const weekVideos: AcademyVideo[] = Object.entries(WEEK_IDS).map(
  ([week, id]) => v(`w${week}`, `Week ${week} — Jeremy`, id),
);

export function getWeekVideo(week: number): AcademyVideo | null {
  const id = WEEK_IDS[week];
  return id ? v(`w${week}`, `Week ${week} — Jeremy`, id) : null;
}

const DAY_LABEL: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  weekend: "Weekend",
};
export const dayLabel = (slot: string) => DAY_LABEL[slot] ?? slot;

export const featuredCoachingVideo = welcomeVideo;

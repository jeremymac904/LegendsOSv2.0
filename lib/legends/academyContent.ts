// Legends Mortgage Academy — behavioral content model (ported from the Loan
// Factory coaching platform, rebranded to Jeremy / LegendsOS). Drives Feed,
// Today, Scorecard, and Resources. No LO Mastery / Alliance labels, no
// non-Jeremy presenters.

import { dailyCoachingVideos, type AcademyVideo } from "./coachingVideos";

// ── Today system ──────────────────────────────────────────────────────────
export type TodayFieldKind = "text" | "number" | "long";
export interface TodayField {
  key: string;
  label: string;
  kind: TodayFieldKind;
  metric?: string; // when set, the value rolls into this scorecard metric
}
export interface TodayDay {
  key: string;
  day: string;
  theme: string;
  instruction: string;
  fields: TodayField[];
  accountability: string[];
  communityPrompt: string;
}

const f = (label: string, kind: TodayFieldKind, metric?: string): TodayField => ({
  key: label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
  label,
  kind,
  metric,
});

export const todayDays: TodayDay[] = [
  {
    key: "monday",
    day: "Monday",
    theme: "Power Block",
    instruction: "Protect your focused work block before the day gets loud.",
    fields: [
      f("Power Block start", "text"),
      f("Power Block end", "text"),
      f("Top three calls", "long"),
      f("Real conversations", "number", "real_conversations"),
      f("Past client touches", "number", "past_client_touches"),
      f("One win", "text"),
    ],
    accountability: [
      "Did you protect your Power Block before noon?",
      "Did every priority call get a next action?",
    ],
    communityPrompt: "Post your Power Block window so another LO can hold you to it.",
  },
  {
    key: "tuesday",
    day: "Tuesday",
    theme: "Follow Up",
    instruction:
      "No lead, borrower, Realtor, or open file should sit without a next action.",
    fields: [
      f("Borrowers followed up", "number"),
      f("Past clients touched", "number", "past_client_touches"),
      f("Real conversations", "number", "real_conversations"),
      f("Next actions created", "number"),
      f("One win", "text"),
      f("Missed opportunities", "long"),
    ],
    accountability: [
      "Does every open file have a next action and a date?",
      "Who did you almost let go quiet?",
    ],
    communityPrompt: "What follow-up needs a next action before the day ends?",
  },
  {
    key: "wednesday",
    day: "Wednesday",
    theme: "Realtor Growth",
    instruction: "Build relationships before you need referrals.",
    fields: [
      f("Realtor conversations", "number", "realtor_conversations"),
      f("Coffee or lunch invites", "number"),
      f("Value items sent", "number"),
      f("Referrals requested", "number", "referrals_requested"),
      f("Agent problems heard", "long"),
      f("Referral opportunities", "long"),
    ],
    accountability: [
      "Did you lead with value before asking for anything?",
      "Which agent relationship moved forward today?",
    ],
    communityPrompt: "Share one agent problem you heard today and how you can solve it.",
  },
  {
    key: "thursday",
    day: "Thursday",
    theme: "Pipeline & Conversion",
    instruction: "Know what is moving, what is stuck, and what needs a decision.",
    fields: [
      f("Real conversations", "number", "real_conversations"),
      f("Applications taken", "number", "applications_taken"),
      f("Pre approvals issued", "number", "pre_approvals_issued"),
      f("Contracts received", "number", "contracts_received"),
      f("Stuck files", "long"),
      f("Deals that need coaching", "long"),
    ],
    accountability: [
      "What is your most stuck file waiting on?",
      "Where did a deal stall this week?",
    ],
    communityPrompt: "Post one stuck file. What decision is it waiting on?",
  },
  {
    key: "friday",
    day: "Friday",
    theme: "Scorecard & Review",
    instruction: "Submit the week so your coaching is grounded in reality.",
    fields: [
      f("Real conversations", "number", "real_conversations"),
      f("Referrals requested", "number", "referrals_requested"),
      f("Applications taken", "number", "applications_taken"),
      f("Closings", "number", "closings"),
      f("Biggest win", "long"),
      f("Biggest stuck point", "long"),
      f("Next week focus", "long"),
    ],
    accountability: [
      "Is your weekly scorecard complete?",
      "What single change protects next week?",
    ],
    communityPrompt: "Post your biggest win of the week in Wins.",
  },
  {
    key: "weekend",
    day: "Weekend",
    theme: "Plan & Reset",
    instruction: "Set the next week before Monday starts.",
    fields: [
      f("Next week top goal", "text"),
      f("Top five borrower follow ups", "long"),
      f("Top five Realtor follow ups", "long"),
      f("One script to practice", "text"),
      f("One system to fix", "text"),
      f("One calendar block to protect", "text"),
    ],
    accountability: [
      "Is Monday's Power Block already on the calendar?",
      "What is next week's one number?",
    ],
    communityPrompt: "Share your top goal for next week so your coach sees it early.",
  },
];

export const todayDayKeys = todayDays.map((d) => d.key);

export function currentDayKey(date = new Date()): string {
  // Note: new Date() with no args is fine in app runtime (client component).
  const idx = date.getDay();
  return [
    "weekend",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "weekend",
  ][idx];
}

/** The Jeremy daily coaching video for a given Today tab. */
export function dailyVideoForDay(dayKey: string): AcademyVideo | undefined {
  return dailyCoachingVideos.find((v) => v.slot === dayKey);
}

// ── Scorecard ───────────────────────────────────────────────────────────────
export interface ScorecardMetric {
  key: string;
  metric: string;
  goal: number;
}
export const scorecardMetrics: ScorecardMetric[] = [
  { key: "real_conversations", metric: "Real conversations", goal: 20 },
  { key: "realtor_conversations", metric: "Realtor conversations", goal: 10 },
  { key: "past_client_touches", metric: "Past client touches", goal: 25 },
  { key: "referrals_requested", metric: "Referrals requested", goal: 5 },
  { key: "applications_taken", metric: "Applications taken", goal: 3 },
  { key: "pre_approvals_issued", metric: "Pre approvals issued", goal: 2 },
  { key: "contracts_received", metric: "Contracts received", goal: 1 },
  { key: "closings", metric: "Closings", goal: 1 },
];
export const scorecardDays = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;

// ── Feed ─────────────────────────────────────────────────────────────────────
export const feedCategories = [
  "All",
  "Pinned",
  "Daily",
  "Weekly",
  "Wins",
  "Questions",
  "Scripts",
] as const;
export type FeedCategory = (typeof feedCategories)[number];

export interface SeedPost {
  id: string;
  author: string;
  role: string;
  category: Exclude<FeedCategory, "All">;
  title: string;
  body: string;
  pinned?: boolean;
  videoEmbedUrl?: string;
  comments: { author: string; body: string }[];
  likes: number;
}

export const feedSeedPosts: SeedPost[] = [
  {
    id: "seed-pin-1",
    author: "Jeremy McDonald",
    role: "Coach",
    category: "Pinned",
    title: "This week's focus: protect the Power Block",
    body: "Before coaching, complete your weekly scorecard and bring one place where your schedule broke. We are not guessing this week — we look at the calendar, the calls, and the next action.",
    pinned: true,
    comments: [
      { author: "Jeremy McDonald", body: "Bring the number and the obstacle." },
    ],
    likes: 12,
  },
  {
    id: "seed-daily-1",
    author: "Jeremy McDonald",
    role: "Coach",
    category: "Daily",
    title: "Monday — start with the database",
    body: "Open Today, protect your Power Block, and make your first three calls before the inbox owns your morning. Today's coaching video is queued for you.",
    videoEmbedUrl: dailyCoachingVideos.find((v) => v.slot === "monday")?.embedUrl,
    comments: [],
    likes: 6,
  },
  {
    id: "seed-weekly-1",
    author: "Jeremy McDonald",
    role: "Coach",
    category: "Weekly",
    title: "Week 1 — Foundation & Commitment",
    body: "This week is about commitment and rhythm. Watch the Week 1 video in the roadmap, then log your first scorecard. Small reps, every day.",
    comments: [],
    likes: 9,
  },
  {
    id: "seed-script-1",
    author: "Jeremy McDonald",
    role: "Coach",
    category: "Scripts",
    title: "Realtor first call: open with curiosity, not pitch",
    body: "Ask three discovery questions before mentioning rates or programs. Earn the meeting first. Full script lives in the Scripts library.",
    comments: [
      { author: "Loan Officer", body: "Used this opener and booked two coffees." },
    ],
    likes: 7,
  },
  {
    id: "seed-win-1",
    author: "Loan Officer",
    role: "Loan Officer",
    category: "Wins",
    title: "Cleared the Tuesday backlog before lunch",
    body: "Batched every active file into one sitting, called each one, and wrote the next action on the tracker. The week got lighter after that.",
    comments: [],
    likes: 5,
  },
  {
    id: "seed-q-1",
    author: "Loan Officer",
    role: "Loan Officer",
    category: "Questions",
    title: "How are you tiering agents this week?",
    body: "I have ten active Realtor relationships but only three feel A-tier. What criteria are you using besides production?",
    comments: [
      { author: "Jeremy McDonald", body: "Fit, response speed, buyer quality, and willingness to co-build." },
    ],
    likes: 3,
  },
];

// ── Resources ────────────────────────────────────────────────────────────────
export interface ResourceLink {
  title: string;
  description: string;
  href: string;
  external?: boolean;
}
export interface ResourceTab {
  key: string;
  label: string;
  blurb: string;
  links: ResourceLink[];
}

export const calendarItems = [
  { day: "Monday", title: "Planning block", time: "8:30 AM", focus: "Database list, weekly number, Power Block setup." },
  { day: "Tuesday", title: "Pipeline rhythm", time: "10:00 AM", focus: "Every active file gets a clear update." },
  { day: "Wednesday", title: "Partner growth lab", time: "1:00 PM", focus: "Agent outreach, meeting prep, relationship review." },
  { day: "Thursday", title: "Follow-up & conversion", time: "11:00 AM", focus: "Warm leads, quiet leads, objection practice." },
  { day: "Friday", title: "Scorecard & next week plan", time: "3:00 PM", focus: "Scorecard, reflection, next week's number." },
];

export const resourceTabs: ResourceTab[] = [
  {
    key: "scripts",
    label: "Scripts",
    blurb: "Buyer, partner, follow-up, and recapture scripts in Legends voice.",
    links: [
      { title: "Scripts Library", description: "First-call, follow-up, buyer, and partner scripts.", href: "/training/scripts" },
      { title: "Script Book (PDF)", description: "Realtor, borrower, follow-up, database, and objection scripts.", href: "https://drive.google.com/file/d/1zA44f6JzhyA4RqpM-cZf46ojA08dLwTJ/view", external: true },
    ],
  },
  {
    key: "tools",
    label: "Tools",
    blurb: "Trackers and planners that make the week visible.",
    links: [
      { title: "Weekly Scorecard", description: "Track leading activity, pace, and reflection.", href: "/training/scorecard" },
      { title: "Today workspace", description: "Daily theme-day execution and time blocking.", href: "/training/today" },
      { title: "Daily Time Blockers (PDF)", description: "Protected Power Blocks, appointments, admin, review.", href: "https://drive.google.com/file/d/1PxpN74w-IK3frRR2ympGC5K3mJOXbrbd/view", external: true },
    ],
  },
  {
    key: "training",
    label: "Training",
    blurb: "Every Legends course in one place.",
    links: [
      { title: "Training Library", description: "AI Advantage, Elite Sales, and the Academy.", href: "/training" },
      { title: "AI Advantage", description: "Jeremy's AI training for loan officers.", href: "/training/ai-advantage" },
      { title: "Academy roadmap", description: "The 12-week Legends Mortgage Academy path.", href: "/coaching" },
    ],
  },
  {
    key: "podcast",
    label: "Podcast",
    blurb: "Coaching audio you can listen to on the go.",
    links: [
      { title: "Audio & Podcasts", description: "Coaching audio library.", href: "/training/audio" },
    ],
  },
  {
    key: "calendar",
    label: "Calendar",
    blurb: "The weekly coaching rhythm.",
    links: [
      { title: "Open Calendar", description: "Plan content, events, and reminders.", href: "/calendar" },
    ],
  },
  {
    key: "downloads",
    label: "Downloads",
    blurb: "Playbooks, trackers, and curriculum PDFs.",
    links: [
      { title: "Script Book", description: "All scripts in one PDF.", href: "https://drive.google.com/file/d/1zA44f6JzhyA4RqpM-cZf46ojA08dLwTJ/view", external: true },
      { title: "Weekly Scorecard", description: "One-page weekly scorecard PDF.", href: "https://drive.google.com/file/d/1UQLx7O4idAeQxYF045beP9Twgq2XsB67/view", external: true },
      { title: "Theme Days Playbook", description: "The weekday operating rhythm.", href: "https://drive.google.com/file/d/1RnHBUW58Q83jyvOFYhnRC-gbsVY2_6Um/view", external: true },
      { title: "Follow Up System", description: "Follow-up rhythm for buyers, leads, and past clients.", href: "https://drive.google.com/file/d/1XK_2bg8PvpJYP8PJNVwnOYwH1sVuKF8A/view", external: true },
      { title: "Realtor Growth System", description: "Partner development system.", href: "https://drive.google.com/file/d/1PxMVznSC2VDg6VA6NIXoo9mIMvsu8soc/view", external: true },
      { title: "Daily Time Blockers", description: "Daily planning templates.", href: "https://drive.google.com/file/d/1PxpN74w-IK3frRR2ympGC5K3mJOXbrbd/view", external: true },
    ],
  },
];

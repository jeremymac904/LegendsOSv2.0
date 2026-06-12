// Coaching programs imported from the Loan Factory coaching platform and
// reframed for LegendsOS (internal). Content is faithful to the source
// curriculum (LO Mastery + Loan Factory Alliance, 12-week tracks); external
// pricing and marketing-site links are intentionally dropped — this is an
// internal team coaching surface, not a sales page.

export interface CoachingProgram {
  key: "mastery" | "alliance";
  name: string;
  rhythm: string;
  bestFor: string;
  includes: string[];
}

export const coachingPrograms: CoachingProgram[] = [
  {
    key: "mastery",
    name: "LO Mastery",
    rhythm: "Biweekly group coaching with daily execution support.",
    bestFor:
      "Loan officers who need structure, follow-up rhythm, scripts, trackers, and weekly accountability.",
    includes: [
      "Weekly execution plan",
      "Daily time blocking",
      "Theme days",
      "Script books",
      "Scorecards",
      "Trackers",
      "Member resources",
      "Community",
    ],
  },
  {
    key: "alliance",
    name: "Loan Factory Alliance",
    rhythm: "Advanced coaching rhythm with tighter accountability.",
    bestFor:
      "Loan officers ready for deeper review, stronger weekly planning, partner development, and business operating systems.",
    includes: [
      "Everything in LO Mastery",
      "Weekly coaching",
      "Advanced planning",
      "Partner strategy",
      "Priority review",
      "Leadership rhythm",
      "Execution scorecards",
      "Community",
    ],
  },
];

export interface CoachingFeature {
  title: string;
  body: string;
}

export const coachingFeatures: CoachingFeature[] = [
  {
    title: "Weekly coaching",
    body: "Clear calls, practical coaching notes, and one next step for the week.",
  },
  {
    title: "Daily execution",
    body: "Time blocks, theme days, and simple habits that make the week visible.",
  },
  {
    title: "Scorecards",
    body: "A lightweight view of activity, follow-up, partner work, and consistency.",
  },
  {
    title: "Trackers",
    body: "Pipeline, Realtor relationships, follow-up, and daily action in one place.",
  },
  {
    title: "Script books",
    body: "Plain-language scripts for first calls, follow-up, buyer conversations, and partner outreach.",
  },
  {
    title: "Community",
    body: "A focused member area for wins, questions, coaching prompts, and accountability.",
  },
];

export interface CoachingWeek {
  week: number;
  theme: string;
  phase: string;
}

// LO Mastery 12-week curriculum (themes faithful to source).
export const masteryWeeks: CoachingWeek[] = [
  { week: 1, theme: "Foundation & Commitment", phase: "Foundation" },
  { week: 2, theme: "Own Your Time", phase: "Foundation" },
  { week: 3, theme: "Own Your Database", phase: "Foundation" },
  { week: 4, theme: "Conversations That Convert", phase: "Conversion" },
  { week: 5, theme: "The Buyer Consultation", phase: "Conversion" },
  { week: 6, theme: "Objection Mastery", phase: "Conversion" },
  { week: 7, theme: "Realtor Partner Outreach", phase: "Partnerships" },
  { week: 8, theme: "Winning the Realtor Relationship", phase: "Partnerships" },
  { week: 9, theme: "Pipeline Discipline & the Tuesday Call", phase: "Systems" },
  { week: 10, theme: "Follow-Up That Closes", phase: "Systems" },
  { week: 11, theme: "Reviews, Referrals & Reputation", phase: "Systems" },
  { week: 12, theme: "The Next 12 Weeks", phase: "Recommit" },
];

// Loan Factory Alliance 12-week curriculum (advanced operating system).
export const allianceWeeks: CoachingWeek[] = [
  { week: 1, theme: "Enterprise Audit & 12-Week Plan", phase: "Audit" },
  { week: 2, theme: "Production Systems & Workflows", phase: "Systems" },
  { week: 3, theme: "The Numbers That Run the Business", phase: "Systems" },
  { week: 4, theme: "Database Reactivation Campaign", phase: "Growth" },
  { week: 5, theme: "Marketing & Content Engine", phase: "Growth" },
  { week: 6, theme: "Assisted Marketing & Follow-Up", phase: "Growth" },
  { week: 7, theme: "Advanced Agent Strategy", phase: "Partnerships" },
  { week: 8, theme: "Agent Mastermind & Co-Marketing", phase: "Partnerships" },
  { week: 9, theme: "Building Leverage", phase: "Leverage" },
  { week: 10, theme: "Leading & Coaching Your People", phase: "Leverage" },
  { week: 11, theme: "Production Growth Roadmap", phase: "Leverage" },
  { week: 12, theme: "Growth Plan & Recommitment", phase: "Recommit" },
];

// Podcast library lives in Supabase Storage (public bucket). These are the
// categories of the Loan Factory coaching podcast collection — surfaced here
// as an at-a-glance map of the audio coaching topics.
export const PODCAST_AUDIO_BASE =
  "https://ajitnzvbplyjrlzwzmwe.supabase.co/storage/v1/object/public/podcasts/";

export const podcastCategories: string[] = [
  "Sales Psychology",
  "Realtor Relationships",
  "Community Marketing",
  "Foreign Language Community Growth",
  "Pipeline Systems",
  "Mortgage Strategy",
  "AI and Automation",
  "Mindset and Discipline",
];

// HeyGen avatar coaching intro (Edward). Unlisted embed.
export const HEYGEN_COACHING_INTRO =
  "https://app.heygen.com/embeds/e3b29b2422d04793b478aaab5d13e7c3";

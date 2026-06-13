// Legends Mortgage Academy — 12-week core curriculum.
// One unified group-coaching track: weekly group coaching call, coach review,
// submit-a-question, and the weekly scorecard. External pricing and
// marketing-site links are intentionally dropped — this is an internal team
// coaching surface, not a sales page.

export interface CoachingFeature {
  title: string;
  body: string;
}

export const coachingFeatures: CoachingFeature[] = [
  {
    title: "Weekly group coaching",
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
  /** Short coaching lesson body for the week (3–5 sentences, Legends voice). */
  lesson: string;
  /** Concrete weekly assignments — each one is checkable in the journey. */
  actions: string[];
  /** The single tracked weekly target ("this week's number"). */
  number: string;
  /** Win condition: what "winning the week" looks like in one sentence. */
  win: string;
}

// Legends Mortgage Academy — Core Track. 12 weeks, four arcs:
// Foundation → Conversion → Partnerships → Systems, closed out by Recommit.
export const masteryWeeks: CoachingWeek[] = [
  {
    week: 1,
    theme: "Foundation & Commitment",
    phase: "Foundation",
    lesson:
      "Legends are built on commitments, not moods. This week you decide what the next 12 weeks are for: one production goal, one daily activity number, and a calendar that proves you mean it. Most loan officers drift because they never define the target — you are going to write yours down and say it out loud on the group coaching call. When the goal is public and the calendar is blocked, the week starts working for you instead of against you.",
    actions: [
      "Write your 12-week production goal and the daily activity number that feeds it.",
      "Block a non-negotiable income-producing hour on your calendar for every weekday.",
      "Complete your Academy business plan and post your commitment in the Academy feed.",
      "Bring your goal and your number to this week's group coaching call.",
    ],
    number: "12-week goal written + 5 work blocks calendared",
    win: "Goal set, plan written, calendar blocked — and said out loud to the group.",
  },
  {
    week: 2,
    theme: "Own Your Time",
    phase: "Foundation",
    lesson:
      "Time is the only inventory a loan officer truly controls, and the market takes it from whoever doesn't defend it. Theme days give each weekday a job, and the protected morning block keeps income-producing activity ahead of the noise. This week you run the structure for five straight days and pay attention to exactly where it breaks. Don't aim for a perfect calendar — aim for a protected one.",
    actions: [
      "Run the theme day every weekday this week.",
      "Protect the income-producing block before noon — no email, no busywork.",
      "Remove one recurring distraction from your mornings and name it on the group call.",
      "Log each completed block in your Today page.",
    ],
    number: "5 protected income blocks completed",
    win: "Five protected blocks completed without surrendering a single morning.",
  },
  {
    week: 3,
    theme: "Own Your Database",
    phase: "Foundation",
    lesson:
      "Your database is your business — everything else is rented attention. The loan officers who close year after year aren't lucky; they simply know who they know, and they talk to those people on purpose. This week you load the names, tag the relationships that matter most, and start daily sphere calls with a simple check-in script. No pitch, no rate talk — just real contact that puts you back in the conversation.",
    actions: [
      "Load 100+ contacts into the CRM.",
      "Tag your top 25 relationship contacts.",
      "Make daily sphere calls using the check-in script.",
      "Log every real conversation in your scorecard.",
    ],
    number: "100 contacts loaded · top 25 tagged",
    win: "Database built, top 25 tagged, and your first sphere calls made.",
  },
  {
    week: 4,
    theme: "Conversations That Convert",
    phase: "Conversion",
    lesson:
      "Volume of conversations beats cleverness of script — but the right structure makes every conversation count twice. FORD (family, occupation, recreation, dreams) opens real talk instead of small talk, and capturing one useful detail afterward turns a chat into a relationship asset. This week is also your first coach review checkpoint: submit your scorecard so the group call can pressure-test your plan against your actual numbers. Conversations are the raw material of this entire program — go get them.",
    actions: [
      "Use FORD to open real conversations every day.",
      "Capture one useful detail after every conversation.",
      "Submit your scorecard for coach review — your first checkpoint.",
      "Bring one win and one blocker to the group coaching call.",
    ],
    number: "25 real conversations logged",
    win: "Conversation target hit and your plan adjusted from coach review.",
  },
  {
    week: 5,
    theme: "The Buyer Consultation",
    phase: "Conversion",
    lesson:
      "Amateurs quote; Legends consult. A buyer consultation run with full discovery — payment comfort, cash-to-close, timeline, and what owning the home actually means to them — converts at a different level than any rate conversation ever will. This week you slow the consult down so the deal speeds up: discovery first, advice second, and a clean next step before anyone hangs up. The framework is the difference between being a lender they talked to and the lender they chose.",
    actions: [
      "Run discovery before quoting or advising — every time.",
      "Ask for payment, cash-to-close, timeline, and ownership goals in every consult.",
      "Set a clean, scheduled next step after each consultation.",
      "Role-play the full consult once before your first live one this week.",
    ],
    number: "3 buyer consultations held with the full framework",
    win: "Consults held using the full framework — no quote before discovery.",
  },
  {
    week: 6,
    theme: "Objection Mastery",
    phase: "Conversion",
    lesson:
      "An objection is not a rejection — it's the borrower telling you exactly where they need help deciding. The pattern is always the same: acknowledge, get curious, reframe, move forward. Reflexes are built in the rep room, not the live call, so this week you drill three objections a day until your weakest answers become automatic. Then you log what you actually hear in live conversations and submit your hardest one as a question for the group coaching call.",
    actions: [
      "Drill three objections per day — out loud, not in your head.",
      "Use acknowledge → curiosity → reframe → move forward on every rep.",
      "Log the objections you hear in live conversations this week.",
      "Submit your toughest objection as a question for the group coaching call.",
    ],
    number: "15 objection role-plays completed",
    win: "Your weakest objections drilled to reflex.",
  },
  {
    week: 7,
    theme: "Realtor Partner Outreach",
    phase: "Partnerships",
    lesson:
      "Agents don't need another lender asking for business — they need a partner who shows up with value first. This week you build a focused 25-agent target list and make value-first contact daily: a useful market insight, a buyer-ready introduction, a tool that makes their week easier. The ask is small on purpose — fifteen minutes, not a commitment. One booked meeting from a deliberate list beats fifty open houses of hopeful small talk.",
    actions: [
      "Build a 25-agent target list with a reason next to every name.",
      "Make value-first agent contacts daily — lead with something useful.",
      "Book at least one short meeting with a target agent.",
      "Log every agent contact in your tracker.",
    ],
    number: "10 new agent contacts · 1 meeting booked",
    win: "Target list active and your first partner meeting booked.",
  },
  {
    week: 8,
    theme: "Winning the Realtor Relationship",
    phase: "Partnerships",
    lesson:
      "The meeting isn't the win — what happens after it is. This week you run discovery on the agent's business the same way you run it on a buyer: where their deals come from, what's slowing them down, and what a great lending partner would actually do for them. Every meeting ends with one concrete next step you own, because partnerships are built on kept promises, not coffee. It's also your second coach review checkpoint — submit your scorecard so the group can see your partner pipeline forming.",
    actions: [
      "Run discovery on each agent's business — sources, stuck points, goals.",
      "Set one concrete next step you own after every meeting.",
      "Deliver one promised piece of value within 48 hours of each meeting.",
      "Submit your scorecard for coach review — your second checkpoint.",
    ],
    number: "3 agent meetings held",
    win: "Real partnership next steps created — not just coffee.",
  },
  {
    week: 9,
    theme: "Pipeline Discipline & the Tuesday Call",
    phase: "Systems",
    lesson:
      "Nothing builds reputation faster than a borrower and an agent who never have to chase you. The Tuesday call is the discipline: every active file gets a status call every Tuesday, whether there's news or not — 'no update' delivered proactively is still an update. This week you review every opportunity, name every stuck point, and tell every party exactly what happens next. Pipelines don't fall apart from bad deals; they fall apart from silence.",
    actions: [
      "Call every active file every Tuesday — no exceptions.",
      "Review every opportunity and name its stuck point.",
      "Communicate what is needed next to every borrower and agent.",
      "Update your deal flow tracker after the calls.",
    ],
    number: "Every active file called on Tuesday",
    win: "Pipeline reviewed, every file updated, nobody chasing you.",
  },
  {
    week: 10,
    theme: "Follow-Up That Closes",
    phase: "Systems",
    lesson:
      "The money in this business is in the follow-up nobody else bothers to do. Pre-approved buyers go quiet, looking buyers stall, old leads cool off — and most loan officers let them, because following up feels like bothering people. It isn't, when you lead with value: a market shift that affects their payment, a new listing in their range, a simple 'still thinking about you.' This week, every open opportunity in your world gets a next-action date, because an opportunity without a next step is just a name in a spreadsheet.",
    actions: [
      "Work every pre-approved and actively-looking buyer this week.",
      "Re-engage quiet leads with value, not 'just checking in.'",
      "Put every open opportunity on a next-action date.",
      "Log your follow-up touches in the scorecard.",
    ],
    number: "25 follow-up touches completed",
    win: "No warm opportunity left without a next step.",
  },
  {
    week: 11,
    theme: "Reviews, Referrals & Reputation",
    phase: "Systems",
    lesson:
      "A closed loan is not the end of the deal — it's the start of the next three, if you ask. Happy clients want to help you; they just need to be asked clearly, at the right moment, with zero awkwardness. This week you ask satisfied clients for reviews, ask past clients and partners for introductions, and write the request down as a repeatable habit so it survives your busiest weeks. Reputation compounds — but only if you feed it on purpose.",
    actions: [
      "Ask your happy clients for reviews this week.",
      "Ask past clients and partners for one introduction each.",
      "Document a repeatable review-request habit you'll run every closing.",
      "Share one client win in the Academy feed.",
    ],
    number: "5 reviews or referrals requested",
    win: "Reputation activity locked into your weekly rhythm.",
  },
  {
    week: 12,
    theme: "The Next 12 Weeks",
    phase: "Recommit",
    lesson:
      "Graduation is a doorway, not a finish line. This week you review the full cycle honestly: which numbers moved, which habits held, and where the next level of your business actually is. Then you build the next 12-week plan — a new weekly number, a schedule that protects what worked, and the accountability rhythm that keeps it alive. Legends don't end strong; they recommit strong.",
    actions: [
      "Review your full 12-week cycle — numbers, habits, and wins.",
      "Choose the weekly number for your next cycle.",
      "Set the next cycle's schedule and accountability rhythm.",
      "Submit your final scorecard and post your graduation plan in the Academy feed.",
    ],
    number: "Next 12-week plan completed",
    win: "Next 12-week plan ready — you graduate recommitted, not finished.",
  },
];

// Podcast library lives in Supabase Storage (public bucket). These are the
// categories of the Academy audio coaching collection — surfaced here as an
// at-a-glance map of the audio coaching topics.
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

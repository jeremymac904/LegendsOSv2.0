// Elite Sales & Marketing — the 101→601 curriculum for the Legends Mortgage
// Academy. Content ported from Jeremy's Elite Sales & Marketing source
// material and rebranded to Legends voice. Only real video URLs are included;
// levels without a published recording simply have no `video` entry.

export type EliteSkillTag =
  | "Beginner"
  | "Intermediate"
  | "Advanced"
  | "Team Leader"
  | "Coach"
  | "Compliance Review";

export interface EliteLevelVideo {
  title: string;
  /** Public watch URL (real, verified in source material). */
  youtubeUrl: string;
  /** YouTube embed URL for inline playback. */
  embedUrl: string;
  description: string;
}

export interface EliteLesson {
  id: string;
  title: string;
  /** Category chip shown on the lesson card (the level's short name). */
  category: string;
  level: string;
}

export interface EliteLevel {
  level: "101" | "201" | "301" | "401" | "501" | "601";
  slug: string;
  /** Short section name, e.g. "Foundation". */
  name: string;
  title: string;
  theme: string;
  corePromise: string;
  audience: string;
  skillTags: EliteSkillTag[];
  doThisToday: string[];
  outcomes: string[];
  /** Lesson cards — the real topic list for the level. */
  lessons: EliteLesson[];
  assignment: string[];
  trackerMetrics: string[];
  complianceWatchOuts: string[];
  behaviorChange?: string;
  /** Only present when a real, live recording exists. */
  video?: EliteLevelVideo;
}

const lessons = (level: string, category: string, titles: string[]): EliteLesson[] =>
  titles.map((title, i) => ({
    id: `${level}-${i + 1}`,
    title,
    category,
    level,
  }));

export const eliteLevels: EliteLevel[] = [
  {
    level: "101",
    slug: "101-foundation",
    name: "Foundation",
    title: "101 Foundation: Build Your Daily Sales Rhythm",
    theme: "Mortgage sales foundation",
    corePromise:
      "By Friday, you have a simple daily plan that creates more real conversations.",
    audience:
      "Brand new loan officer or experienced LO who feels scattered and wants a simple weekly system.",
    skillTags: ["Beginner"],
    doThisToday: [
      "Send five follow up texts to leads or past clients.",
      "Practice the 30 second broker value prop out loud twice.",
      "Log every real conversation you had today.",
    ],
    outcomes: [
      "Explain the broker model in plain English.",
      "Run a daily standard of 5 to 8 real conversations.",
      "Send a clean, compliant first text after a new lead.",
      "Use an AI prompt to draft a follow-up text in under a minute, then edit it.",
      "Track conversations, partner touches, and past client touches every day.",
    ],
    lessons: lessons("101", "Foundation", [
      "Broker model positioning in plain English",
      "Why the broker model wins versus banks and retail lenders, without bashing competitors",
      "The first borrower conversation",
      "The first referral partner conversation",
      "Confidence without fake hype",
      "Scripts for the first call",
      "Daily activity tracking basics",
    ]),
    assignment: [
      "Log 25 or more real conversations across the week.",
      "Update one professional channel (Google Business Profile or LinkedIn) with current photo, NMLS ID, brokerage, and contact link.",
      "Send three personalized past client texts. Not a blast. One sentence about them.",
      "Use the first-text AI prompt at least three times this week, then edit each draft.",
      "Submit one short note on what slowed you down most this week.",
    ],
    trackerMetrics: [
      "Conversations per day",
      "Past client touches per week",
      "Partner touches per week",
      "Content ideas captured for later use",
      "Friday review attended yes or no",
    ],
    complianceWatchOuts: [
      "No rates, no payments, no specific fees in any 101 outbound message.",
      "NMLS ID must appear on every borrower facing message.",
      "Past client outreach about specific rate or payment terms requires Reg Z disclosures.",
    ],
    behaviorChange:
      "By Friday, the LO is running a daily activity standard and has at least 25 logged conversations.",
    video: {
      title: "Elite Sales & Marketing 101 Training Video",
      youtubeUrl: "https://youtu.be/fdqe2poMc98",
      embedUrl: "https://www.youtube.com/embed/fdqe2poMc98",
      description:
        "Watch this training first, then use the scripts, prompts, roleplays, and tracker resources to complete the 101 Foundation lesson.",
    },
  },
  {
    level: "201",
    slug: "201-borrower-conversion",
    name: "Borrower Conversion",
    title: "201 Borrower Conversion: Win the First Call",
    theme: "Borrower conversion and consultation structure",
    corePromise:
      "You turn more first conversations into clear next steps and completed applications.",
    audience: "Any LO with at least 30 days of LO experience.",
    skillTags: ["Intermediate"],
    doThisToday: [
      "Run one first call using the High Trust Intake.",
      "Ask better questions, not more questions. Target 15 to 16 quality questions.",
      "Set a dated next step before you end the call.",
    ],
    outcomes: [
      "Run a structured first call that builds trust in 15 minutes.",
      "Hit a 43:57 talk to listen ratio.",
      "Redirect rate and fee questions without teaser talk.",
      "Always end the call with a dated next step.",
      "Use an AI pre-call brief before important first calls.",
    ],
    lessons: lessons("201", "Borrower Conversion", [
      "The borrower journey",
      "High trust discovery questions",
      "Pain point questions",
      "Talk to listen ratio (target 43:57)",
      "Explaining options as paths, not specific rates",
      "Moving from conversation to application",
      "Follow up the same day",
    ]),
    assignment: [
      "Record three real first calls with borrower consent.",
      "Self score each call using the first call rubric (open, questions, talk ratio, plan summary, next step).",
      "Submit one written call recap.",
      "Use the AI pre-call brief prompt before every recorded practice call.",
    ],
    trackerMetrics: [
      "Pre qual to app conversion rate",
      "First call talk to listen ratio (estimated)",
      "Average questions asked per first call",
      "Recorded calls submitted this week",
    ],
    complianceWatchOuts: [
      "No teaser rates in any borrower facing artifact.",
      "Avoid promises about closing dates or guarantees.",
      "Reg Z triggering terms list reviewed before any printed or posted material.",
    ],
    behaviorChange:
      "LO talk to listen ratio moves toward the 43:57 golden ratio. Question quality improves week over week.",
  },
  {
    level: "301",
    slug: "301-referral-partner-growth",
    name: "Referral Partner Growth",
    title: "301 Referral Partner Growth: Build Stronger Realtor Relationships",
    theme: "Referral partner growth",
    corePromise:
      "You build a repeatable plan for new Realtor and referral partner conversations.",
    audience: "Any LO with a stable borrower process.",
    skillTags: ["Intermediate", "Advanced", "Compliance Review"],
    doThisToday: [
      "Pick five priority Realtors from your market.",
      "Send three personalized outreaches with one specific detail in each.",
      "Book one 15 minute conversation this week.",
    ],
    outcomes: [
      "Build a list of 25 priority partners with public research.",
      "Send personalized outreach in waves of 5 per week.",
      "Run a clean first partner meeting.",
      "Make a confident listing agent call on every offer.",
      "Stay clear of RESPA Section 8 risk.",
    ],
    lessons: lessons("301", "Partner Growth", [
      "Realtor partner psychology",
      "What Realtors actually care about (speed, communication, closing certainty)",
      "CPA, financial advisor, builder, divorce attorney opportunities",
      "The first outreach message",
      "The follow up sequence",
      "The partner value offer",
      "Partner meeting structure",
      "Co marketing inside RESPA",
    ]),
    assignment: [
      "Build a list of 25 potential referral partners with public research notes.",
      "Send 10 personalized partner outreaches this week.",
      "Book at least one new partner conversation.",
      "Make at least one listing agent call on an active file.",
    ],
    trackerMetrics: [
      "New partner outreaches this week",
      "Partner meetings booked",
      "Partner meetings held",
      "Active deals sourced from named partners",
    ],
    complianceWatchOuts: [
      "RESPA Section 8 applies. No things of value in exchange for referrals.",
      "Co marketing only with documented pro rata share, both parties paying.",
      "No gift cards, paid subscriptions, or paid event tickets tied to referrals.",
      "Any new MSA structure requires corporate approval.",
    ],
    behaviorChange:
      "LO has 5 named priority partners and at least one active deal sourced from one of them.",
  },
  {
    level: "401",
    slug: "401-content-and-marketing",
    name: "Content & Marketing",
    title: "401 Content and Marketing: Be Easier to Find and Trust",
    theme: "Content and authority marketing",
    corePromise:
      "You build a local presence that helps borrowers and Realtors understand what you do.",
    audience: "Any LO ready to be visible.",
    skillTags: ["Intermediate", "Advanced", "Compliance Review"],
    doThisToday: [
      "Record one 60 second video on your phone using the hook then example then CTA structure.",
      "Publish one Google Business Profile post about a local market detail.",
      "Run the compliance safe content decision tree before you publish anything.",
    ],
    outcomes: [
      "Pick one content pillar that matches your market.",
      "Master five hook patterns for short form video.",
      "Build a fully optimized Google Business Profile.",
      "Publish at a sustainable weekly cadence.",
      "Pass the compliance safe content decision tree before every post.",
    ],
    lessons: lessons("401", "Content & Marketing", [
      "Personal brand and one content pillar",
      "Short form video hooks (5 patterns)",
      "60 second video template",
      "Compliant social posts",
      "Google Business Profile build and weekly post",
      "Monthly email newsletter",
      "Repurposing one topic across six channels",
      "Compliance safe content decision tree",
    ]),
    assignment: [
      "Post three short videos this week.",
      "Complete your Google Business Profile build checklist.",
      "Draft and schedule your monthly newsletter.",
      "Run every piece through the compliance safe content decision tree before publishing.",
    ],
    trackerMetrics: [
      "Short videos posted per week",
      "Google Business Profile posts per week",
      "Reviews requested and received this month",
      "Newsletter sent yes or no",
      "Pieces flagged in compliance review",
    ],
    complianceWatchOuts: [
      "Reg Z triggering terms (specific down payment, payment period, specific payment, specific finance charge) trigger full disclosures.",
      "NMLS ID must appear on every social profile and every post that promotes credit.",
      "Equal Housing logo where required.",
      "No superlatives like best rate or guaranteed approval.",
      "No unverified comparisons to named competitors.",
    ],
    behaviorChange:
      "LO has a real digital footprint a borrower or Realtor can find on day one of a search.",
  },
  {
    level: "501",
    slug: "501-pipeline-and-sales-systems",
    name: "Pipeline & Follow-Up",
    title: "501 Pipeline and Follow-Up: Stay in Control",
    theme: "Follow up, pipeline, and database discipline",
    corePromise: "You stop losing opportunities because follow-up got messy.",
    audience: "Producer or experienced LO.",
    skillTags: ["Intermediate", "Advanced"],
    doThisToday: [
      "Review every active file in your pipeline.",
      "Assign each file a status and a dated next step.",
      "Send one proactive status update to a borrower or Realtor on an active file.",
    ],
    outcomes: [
      "Run a 15 minute Friday production review every week.",
      "Hold every active file at one of four statuses with a dated next step.",
      "Segment past clients and run a real touch routine.",
      "Use AI prompts to draft personal past-client and follow-up messages, then edit them.",
      "Build a more consistent past-client follow-up routine.",
    ],
    lessons: lessons("501", "Pipeline Systems", [
      "Pipeline stages (hot, warm, watch, dead)",
      "Speed to lead",
      "Pre approval follow up",
      "Realtor weekly proactive status updates",
      "Past client touch plan by tenure",
      "Weekly pipeline review (15 minutes)",
      "AI-assisted follow up",
      "Pipeline and tracker discipline",
    ]),
    assignment: [
      "Clean your pipeline. Every file has a status and a dated next step.",
      "Segment your past client list by tenure (0 to 12 months, 1 to 3 years, 3+ years).",
      "Send 20 personalized past client touches this week.",
      "Run one full Friday pipeline review with your team leader or coach.",
    ],
    trackerMetrics: [
      "Pipeline hygiene score",
      "Past client touches per week",
      "Refi or repeat conversations started",
      "Pre approval to app to close conversion percentages",
      "Active files without a dated next step",
    ],
    complianceWatchOuts: [
      "Past client outreach about specific rate or payment terms is a Reg Z advertisement and requires disclosures.",
      "No claims about guaranteed savings or guaranteed approvals.",
    ],
    behaviorChange:
      "LO has a cleaner pipeline, fewer missing next steps, and a steadier past-client touch plan.",
  },
  {
    level: "601",
    slug: "601-elite-execution",
    name: "Elite Execution",
    title: "601 Elite Execution: Build Your Niche Plan",
    theme: "Elite execution",
    corePromise:
      "You leave with a written 12-week plan and a simple set of AI prompts you can actually use.",
    audience: "Producer, team leader, or coach.",
    skillTags: ["Advanced", "Team Leader", "Coach"],
    doThisToday: [
      "Pick one niche and commit to it for the next 90 days.",
      "Draft your 12 week plan in one page. No more.",
      "Choose one AI prompt routine to build first and document what goes in and what should come out.",
    ],
    outcomes: [
      "Pick one niche and write a 12 week plan.",
      "Use AI prompts across prep, follow-up, content, roleplay, and weekly review.",
      "Build a one page weekly scorecard.",
      "Submit a partner roster of five named priority partners.",
      "Earn the Legends Elite Sales & Marketing certification.",
    ],
    lessons: lessons("601", "Elite Execution", [
      "Niche strategy (self employed, VA, first time buyer, investor, divorce, builder)",
      "90 day campaign plan tied to niche",
      "Weekly sales, marketing, partner, pipeline rhythm",
      "Scorecard review",
      "AI prompt routine",
      "Team leader accountability",
      "Next 90 day plan",
      "Certification requirements",
    ]),
    assignment: [
      "Submit your 12 week niche plan.",
      "Submit your AI prompt checklist with at least six useful prompts.",
      "Build your one page weekly scorecard.",
      "Submit your partner roster (five named priority partners).",
      "Submit two final recorded first calls scored above rubric threshold.",
    ],
    trackerMetrics: [
      "12 week plan submitted",
      "AI prompt routine logged",
      "Scorecard built",
      "Niche pre quals started",
      "Niche referral partner meetings held",
    ],
    complianceWatchOuts: [
      "All niche marketing reviewed before publish.",
      "Co marketing inside RESPA. Pro rata only.",
    ],
    behaviorChange:
      "LO operates with a written plan and a measurable weekly scorecard.",
  },
];

export const eliteLessonCount = eliteLevels.reduce(
  (sum, level) => sum + level.lessons.length,
  0
);

export function findEliteLevel(slug: string): EliteLevel | undefined {
  return eliteLevels.find((l) => l.slug === slug);
}

/** Flat lesson list (used for previews and search surfaces). */
export const allEliteLessons: EliteLesson[] = eliteLevels.flatMap(
  (l) => l.lessons
);

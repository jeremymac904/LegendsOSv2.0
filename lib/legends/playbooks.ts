// Legends Mortgage Academy — Execution Playbooks.
//
// Step-by-step plays the LO runs against real situations: partner outreach,
// buyer consults, follow-up, database reactivation, and pipeline inspection.
// Steps are checkable in the PlaybooksPanel; checked state persists to
// localStorage under `legendsos:academy:playbooks`.

export interface Playbook {
  key: string;
  title: string;
  category: string;
  /** The situation that should trigger this playbook. */
  whenToUse: string;
  /** Ordered, checkable steps. */
  steps: string[];
  /** What done looks like when every step is checked. */
  outcome: string;
}

export const PLAYBOOKS_STORAGE_KEY = "legendsos:academy:playbooks";

/** Checked step indices per playbook key. */
export type PlaybookProgress = Record<string, number[]>;

export const playbooks: Playbook[] = [
  {
    key: "realtor-growth",
    title: "Realtor Growth Playbook",
    category: "Partners",
    whenToUse:
      "You want more agent referrals but your outreach keeps turning into a pitch instead of a relationship.",
    steps: [
      "Build a focused list of agents — quality over volume.",
      "Open with market curiosity, not a sales script.",
      "Earn a 15-minute meeting.",
      "Bring one genuinely useful idea to the meeting.",
      "Set a real next action before leaving.",
    ],
    outcome:
      "A focused agent list with real meetings on the calendar and a concrete next action attached to every partner.",
  },
  {
    key: "buyer-consultation",
    title: "Buyer Consultation Playbook",
    category: "Conversion",
    whenToUse:
      "Before every buyer consult — especially when the borrower opens with “what's your rate?”",
    steps: [
      "Ask the four goals: payment, cash-to-close, timeline, and ownership.",
      "Clarify tradeoffs before recommending a structure.",
      "Set one clear next step.",
      "Document the borrower's goal and the follow-up date.",
    ],
    outcome:
      "Consults that run on discovery instead of rate quotes — every borrower leaves with a documented goal and a follow-up date.",
  },
  {
    key: "follow-up-system",
    title: "Follow-Up System Playbook",
    category: "Follow-Up",
    whenToUse:
      "Warm leads, buyers, and past clients are sitting silent in your pipeline with no scheduled next touch.",
    steps: [
      "Separate warm leads, pre-approved buyers, past clients, and partner promises.",
      "Assign every contact a next message and a due date.",
      "Work the follow-up queue before reactive work each day.",
      "Review the full queue every Friday.",
    ],
    outcome:
      "Every warm lead, buyer, partner, and past client carries a visible next action — nothing dies in silence.",
  },
  {
    key: "database-reactivation",
    title: "Database Reactivation Playbook",
    category: "Database",
    whenToUse:
      "Your database is full of past clients and sphere contacts you haven't touched in months.",
    steps: [
      "Segment the database: past clients, sphere, partners, older opportunities.",
      "Choose one segment to work this week.",
      "Write a personal first line for the segment — no blast templates.",
      "Track responses and assign a next action to each reply.",
      "Bring the campaign results to the weekly group coaching call.",
    ],
    outcome:
      "Dormant contacts moving again — responses tracked, next actions assigned, and results reviewed with the group.",
  },
  {
    key: "pipeline-inspection",
    title: "Pipeline Inspection Playbook",
    category: "Pipeline",
    whenToUse:
      "You can't say exactly where deals stall — the pipeline runs on vibes instead of ratios.",
    steps: [
      "Pull every active file into the Conversion Tracker.",
      "Identify the weakest handoff in the funnel.",
      "Pick one system fix for that handoff.",
      "Document the new workflow before the week ends.",
      "Bring the ratio change to coach review next week.",
    ],
    outcome:
      "A pipeline managed by conversion ratios, with one documented system fix shipped every week.",
  },
  {
    key: "partner-tier-review",
    title: "Partner Tier Review Playbook",
    category: "Partners",
    whenToUse:
      "Each quarter — or whenever partner touches feel scattered across too many agents to matter.",
    steps: [
      "Pull every active agent relationship into the Realtor Relationship Tracker.",
      "Score each by volume, buyer quality, response speed, and co-build willingness.",
      "Pressure-test the A-tier list on the weekly group coaching call.",
      "Write a value plan for each A-tier partner.",
      "Schedule the next quarterly review before closing this one.",
    ],
    outcome:
      "A re-tiered partner list with an intentional value plan behind every A-tier agent — touches focused where they pay.",
  },
  {
    key: "first-time-buyer",
    title: "First-Time Buyer Walkthrough Playbook",
    category: "Conversion",
    whenToUse:
      "A nervous first-time buyer just landed — you need to take them from first call to a confident pre-approval.",
    steps: [
      "Open with what they're trying to accomplish, not with rates.",
      "Run the four-goal framework: payment, cash-to-close, timeline, ownership.",
      "Set the price range from their real numbers.",
      "Send the pre-approval checklist the same day.",
      "Schedule the status call before you hang up.",
    ],
    outcome:
      "A first-time buyer who understands their numbers, has the checklist in hand, and a status call already on the calendar.",
  },
];

/**
 * Legends Growth Academy — curriculum catalog.
 *
 * Static data file. No live DB writes. No external network calls.
 * Used by `/training/academy/**` routes to render Legends-branded
 * sales, marketing, AI, and mastery tracks for The Legends Mortgage Team.
 *
 * Branding rules (enforced in copy):
 *   - Legends voice, not Loan Factory voice.
 *   - "Powered by Loan Factory" attribution only where appropriate.
 *   - No rate / fee / APR / approval / underwriting claims.
 *   - Use "LO" or "loan officer", never "ELO".
 *   - Use "TERA", never "MOSO".
 */

export type AcademyTrack = "sales" | "marketing" | "ai" | "mastery";

export type AcademyLevel = 101 | 201 | 301 | 401 | 501 | 601 | "track-only";

export type AcademyStatus = "available" | "draft" | "coming-soon";

export interface CurriculumModule {
  id: string;
  track: AcademyTrack;
  level: AcademyLevel;
  title: string;
  summary: string;
  durationMinutes: number;
  status: AcademyStatus;
  learningOutcomes: string[];
  body?: string;
  internalNotes?: string;
}

export interface CurriculumTrack {
  slug: AcademyTrack;
  displayName: string;
  tagline: string;
  description: string;
  audience: string;
  modules: CurriculumModule[];
}

export const ACADEMY_TRACKS: CurriculumTrack[] = [
  {
    slug: "sales",
    displayName: "Sales Track",
    tagline: "Repeatable mortgage sales execution for the Legends team.",
    description:
      "A 101 to 601 progression covering buyer conversation discipline, pipeline rhythm, partner conversations, and follow-through. Adapted internally for The Legends Mortgage Team. Internal team use only — not a public training program.",
    audience: "All Legends loan officers, from first-year through producing.",
    modules: [
      {
        id: "sales-101",
        track: "sales",
        level: 101,
        title: "Foundations: How a Legends conversation sounds",
        summary:
          "The shape of a Legends first-call. What we say, what we never say, and how to leave a buyer wanting the next step instead of feeling sold.",
        durationMinutes: 25,
        status: "available",
        learningOutcomes: [
          "Open a conversation without quoting a rate, fee, or approval.",
          "Identify the buyer's real next step instead of pitching a product.",
          "End every call with one specific commitment from the buyer.",
        ],
        body: "### The Legends Conversation\n\nAt Legends, we don't sell loans; we guide buyers. The first call is about **Discovery**, not **Quoting**.\n\n**The 'No-Rate' Opener:**\nWhen a buyer asks 'What's your rate?', your response should be: 'I'd love to give you an accurate answer, but a rate without a strategy is just a number. Before we talk about interest, can we talk about your goals?'\n\n**Three Pillars of a Legends Call:**\n1. **Empathy:** Understand the 'why' behind the move.\n2. **Authority:** Show you know the process, not just the products.\n3. **Commitment:** Never end a call without a clear next step (e.g., 'I'll send you the document list, and you'll have it back to me by Tuesday').",
      },
      {
        id: "sales-201",
        track: "sales",
        level: 201,
        title: "Discovery: Hearing what the buyer is not saying",
        summary:
          "Reading the buyer behind the question. Timeline, motivation, anxieties, and what to do when the buyer asks for a number too early.",
        durationMinutes: 30,
        status: "draft",
        learningOutcomes: [
          "Map four buyer archetypes Legends sees most often.",
          "Reframe rate questions into preparation questions.",
          "Capture enough context to make the second call obvious.",
        ],
      },
      {
        id: "sales-301",
        track: "sales",
        level: 301,
        title: "Pipeline: Weekly rhythm that scales without burnout",
        summary:
          "How a Legends LO runs a steady week — outbound, in-process, in-recapture — and how to stop letting one urgent file destroy three follow-ups.",
        durationMinutes: 35,
        status: "draft",
        learningOutcomes: [
          "Build a Legends weekly board (no software needed).",
          "Decide what to drop when capacity hits.",
          "Track three numbers that predict next quarter, not last week.",
        ],
      },
      {
        id: "sales-401",
        track: "sales",
        level: 401,
        title: "Partner conversations: Realtors, CPAs, financial advisors",
        summary:
          "Why Legends earns referral partnerships instead of asking for them. The four conversations that turn a casual contact into a repeating source.",
        durationMinutes: 40,
        status: "draft",
        learningOutcomes: [
          "Open a partner conversation without leading with rates or products.",
          "Co-design one piece of buyer education with a partner.",
          "Set a 30-day follow-up cadence that the partner welcomes.",
        ],
      },
      {
        id: "sales-501",
        track: "sales",
        level: 501,
        title: "Recapture: The past-client conversation Legends owns",
        summary:
          "How to talk to a past client about a refi, a HELOC, or a second purchase without sounding like a chase. Plus the discipline to do it monthly, not when a rate moves.",
        durationMinutes: 30,
        status: "draft",
        learningOutcomes: [
          "Build a Legends past-client review cadence.",
          "Write a recapture message that does not lead with numbers.",
          "Decide when a past client should not be contacted yet.",
        ],
      },
      {
        id: "sales-601",
        track: "sales",
        level: 601,
        title: "Leadership: Mentoring the next Legends LO",
        summary:
          "When you become the LO others ask for help. Coaching newer Legends teammates without owning their pipeline, and protecting your own production while you do it.",
        durationMinutes: 35,
        status: "draft",
        learningOutcomes: [
          "Run a one-page weekly check-in with a mentee.",
          "Diagnose pipeline issues without taking over the file.",
          "Give feedback that drives behavior change without breaking trust.",
        ],
      },
    ],
  },
  {
    slug: "marketing",
    displayName: "Marketing Track",
    tagline: "Compliant, on-voice Legends marketing without the noise.",
    description:
      "How Legends LOs draft, review, and ship marketing without quoting numbers, overpromising, or creating compliance debt. Covers social cadence, partner content, buyer education, and the Legends review path.",
    audience: "Legends loan officers and the owner reviewing marketing output.",
    modules: [
      {
        id: "marketing-101",
        track: "marketing",
        level: 101,
        title: "Voice: How Legends sounds in writing",
        summary:
          "The Legends marketing voice in plain terms — what to say, what to avoid, and how to keep a post feeling like a teammate instead of a billboard.",
        durationMinutes: 20,
        status: "available",
        learningOutcomes: [
          "Recognize three patterns that read as 'mortgage spam'.",
          "Rewrite a generic mortgage tip in Legends voice.",
          "Decide when a draft is internal-only vs. partner-safe vs. borrower-safe.",
        ],
        body: "### The Legends Voice\n\nMarketing at Legends should feel like a conversation with a trusted advisor, not a sales pitch from a billboard.\n\n**Spam Patterns to Avoid:**\n- **ALL CAPS:** 'LOWEST RATES EVER!!!'\n- **Fake Urgency:** 'ACT NOW OR LOSE YOUR CHANCE!'\n- **Generic Stock Photos:** Use authentic, brand-consistent visuals from Image Studio instead.\n\n**The 'Teammate' Test:**\nRead your draft out loud. Would you say this to a friend over coffee? If it sounds too formal or too 'salesy', rewrite it in plain English.",
      },
      {
        id: "marketing-201",
        track: "marketing",
        level: 201,
        title: "Cadence: A Legends week of content",
        summary:
          "A predictable, low-noise content rhythm — three posts, one email, one short video — that a Legends LO can run without burning out.",
        durationMinutes: 25,
        status: "draft",
        learningOutcomes: [
          "Plan a one-week content sprint inside LegendsOS.",
          "Repurpose one buyer conversation into three posts.",
          "Trim a content idea before it becomes ten unfinished drafts.",
        ],
      },
      {
        id: "marketing-301",
        track: "marketing",
        level: 301,
        title: "Buyer education: Teaching without quoting",
        summary:
          "How Legends teaches buyers about pre-approval, documents, affordability, and timelines without making rate, payment, or approval claims.",
        durationMinutes: 30,
        status: "draft",
        learningOutcomes: [
          "Draft an educational post that passes a Legends review without edits.",
          "Replace four risky phrases with safe Legends alternatives.",
          "Translate jargon into language a first-time buyer can use.",
        ],
      },
      {
        id: "marketing-401",
        track: "marketing",
        level: 401,
        title: "Realtor partner content: Co-marketing that earns trust",
        summary:
          "Co-branded content with realtor partners — listing prep, open house prep, buyer prep — without overstepping NMLS limits or partner brand boundaries.",
        durationMinutes: 30,
        status: "draft",
        learningOutcomes: [
          "Co-design one short campaign with a realtor partner.",
          "Pre-clear realtor co-branding with the Legends review.",
          "Avoid the four most common partner-content compliance traps.",
        ],
      },
      {
        id: "marketing-501",
        track: "marketing",
        level: 501,
        title: "Recapture marketing: Past clients without chasing",
        summary:
          "A monthly past-client touchpoint Legends can run that adds value first and never reads like an interest-rate ping.",
        durationMinutes: 25,
        status: "draft",
        learningOutcomes: [
          "Build a six-month past-client touchpoint plan.",
          "Write a recapture email that does not lead with a number.",
          "Decide what to do when a past client unsubscribes.",
        ],
      },
      {
        id: "marketing-601",
        track: "marketing",
        level: 601,
        title: "Review path: How Legends approves what ships",
        summary:
          "The Legends internal review path — what gets flagged, how to ask for review without creating extra work, and how to ship faster by writing safer drafts the first time.",
        durationMinutes: 25,
        status: "draft",
        learningOutcomes: [
          "Use the Legends compliance footer correctly.",
          "Decide which drafts need owner review before publishing.",
          "Track recurring review feedback and fix it at the source.",
        ],
      },
    ],
  },
  {
    slug: "ai",
    displayName: "AI Track",
    tagline: "How Legends uses AI without faking the work.",
    description:
      "Hands-on, internal training for using LegendsOS Atlas, the prompt library, image generation, and AI-assisted drafting — without overpromising or replacing the human conversation.",
    audience: "All Legends teammates using LegendsOS day to day.",
    modules: [
      {
        id: "ai-101",
        track: "ai",
        level: 101,
        title: "Atlas basics: The Legends way to chat with AI",
        summary:
          "How Atlas is wired, what it can and cannot do, and how to ask for help that the team can actually use. Covers threads, knowledge sources, and when to start a new thread.",
        durationMinutes: 20,
        status: "available",
        learningOutcomes: [
          "Start a focused Atlas thread instead of an open-ended chat.",
          "Recognize when Atlas is confident vs. guessing.",
          "Keep borrower PII out of every Atlas message.",
        ],
        body: "### Atlas Basics\n\nAtlas is your AI command center inside LegendsOS. It's grounded in our team's knowledge sources, process docs, and compliance rules.\n\n**The Golden Rule:** Never put borrower PII (Social Security Numbers, full birthdays, specific loan numbers) into Atlas. AI threads are processed through secure gateways, but we maintain strict data hygiene.\n\n**Focused Threads:** Instead of one long chat, start a new thread for every new topic (e.g., 'VA Jumbo Scenario', 'Realtor Outreach Email'). This keeps Atlas's 'context window' clean and helps it give better answers.",
      },
      {
        id: "ai-201",
        track: "ai",
        level: 201,
        title: "Prompt patterns: Reusable Legends prompts",
        summary:
          "The Legends prompt library and how to adapt a prompt to a real conversation without losing the guardrails.",
        durationMinutes: 25,
        status: "draft",
        learningOutcomes: [
          "Pick a prompt from the library and customize it correctly.",
          "Spot prompts that are too vague to be useful.",
          "Save a prompt you reuse into the Legends shared library.",
        ],
      },
      {
        id: "ai-301",
        track: "ai",
        level: 301,
        title: "Drafting with Atlas: Social, email, partner outreach",
        summary:
          "Using Atlas to draft Legends-voice content. Reviewing AI output for tone, facts, and risk before anything ships.",
        durationMinutes: 30,
        status: "draft",
        learningOutcomes: [
          "Generate a draft and rewrite it in your own voice.",
          "Spot AI overreach (rate claims, approval claims, fake numbers).",
          "Cite a knowledge source inside an Atlas draft.",
        ],
      },
      {
        id: "ai-401",
        track: "ai",
        level: 401,
        title: "Image Studio: Brand-safe visuals without designer chaos",
        summary:
          "Using LegendsOS Image Studio for partner content, social, and education — including when to stop generating and start designing intentionally.",
        durationMinutes: 25,
        status: "draft",
        learningOutcomes: [
          "Generate a Legends-brand-safe visual from a prompt.",
          "Decide which assets ship vs. stay in drafts.",
          "Avoid imagery that creates compliance or fair-housing risk.",
        ],
      },
      {
        id: "ai-501",
        track: "ai",
        level: 501,
        title: "Persona roleplay: Practicing the call with AI",
        summary:
          "Using Atlas as a buyer, realtor, or recapture target persona to practice tough conversations. Internal use only, never with real borrower data.",
        durationMinutes: 30,
        status: "draft",
        learningOutcomes: [
          "Run a roleplay against a Legends persona.",
          "Score your own call against three behavior markers.",
          "Choose the next persona to practice based on real pipeline pain.",
        ],
        internalNotes:
          "Wires into the upcoming Roleplay Lab. Catalog only in this sprint.",
      },
      {
        id: "ai-601",
        track: "ai",
        level: 601,
        title: "Coaching with AI: When the assistant is wrong",
        summary:
          "How to use AI as a teammate, not an oracle. When to override Atlas, when to escalate to the owner, and how to feed corrections back so the team gets smarter together.",
        durationMinutes: 25,
        status: "draft",
        learningOutcomes: [
          "Catch three common Atlas failure modes.",
          "Write a clean correction that improves the next response.",
          "Decide when an AI answer needs human escalation.",
        ],
      },
    ],
  },
  {
    slug: "mastery",
    displayName: "Mastery Track",
    tagline: "Senior Legends execution — depth, not noise.",
    description:
      "Deeper-track modules for producing Legends LOs and team leads. Internal — replaces the prior \"Apex Advisor\" framing. No paid tier inside LegendsOS.",
    audience:
      "Producing Legends loan officers, team leads, and anyone Jeremy invites into the mastery cadence.",
    modules: [
      {
        id: "mastery-deal-structure",
        track: "mastery",
        level: "track-only",
        title: "Deal structure thinking",
        summary:
          "How to reason about deal structure without giving up the conversation. Frameworks for talking through tradeoffs with a borrower — without quoting outcomes.",
        durationMinutes: 40,
        status: "draft",
        learningOutcomes: [
          "Walk a borrower through a tradeoff conversation.",
          "Identify three deal-structure patterns Legends sees often.",
          "Decide when to stop and re-scope before quoting anything.",
        ],
      },
      {
        id: "mastery-pipeline-mechanics",
        track: "mastery",
        level: "track-only",
        title: "Pipeline mechanics at scale",
        summary:
          "How a producing Legends LO keeps a 30+ active pipeline without dropping balls — without faking discipline with software.",
        durationMinutes: 45,
        status: "draft",
        learningOutcomes: [
          "Run a weekly 30-minute pipeline review you actually keep.",
          "Pick what to delegate vs. what to keep.",
          "Set a leading indicator that warns before production drops.",
        ],
      },
      {
        id: "mastery-team-leader-os",
        track: "mastery",
        level: "track-only",
        title: "Team Lead OS (preview)",
        summary:
          "Preview of the Legends Team Lead OS — scorecards, recruiting cadence, recognition log. Owner-led in this sprint; gated behind owner role.",
        durationMinutes: 35,
        status: "coming-soon",
        learningOutcomes: [
          "Understand what a Legends team lead is accountable for weekly.",
          "Read a team scorecard without overreacting to one number.",
          "Run a recognition rhythm that the team actually feels.",
        ],
        internalNotes: "Surface lands behind owner gate in a later sprint.",
      },
    ],
  },
];

export function findTrack(slug: string): CurriculumTrack | null {
  return ACADEMY_TRACKS.find((track) => track.slug === slug) ?? null;
}

export function findModule(
  trackSlug: string,
  moduleId: string
): { track: CurriculumTrack; moduleEntry: CurriculumModule } | null {
  const track = findTrack(trackSlug);
  if (!track) return null;
  const moduleEntry = track.modules.find((entry) => entry.id === moduleId);
  if (!moduleEntry) return null;
  return { track, moduleEntry };
}

export function trackModuleCount(slug: AcademyTrack): number {
  return findTrack(slug)?.modules.length ?? 0;
}

export function statusLabel(status: AcademyStatus): string {
  if (status === "available") return "Available";
  if (status === "coming-soon") return "Coming soon";
  return "Draft";
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  GraduationCap,
  Headphones,
  Megaphone,
  Sparkles,
  XCircle,
} from "lucide-react";

import {
  calendarInviteNote,
  calendarItems,
  resourceTabs,
  type ResourceLink,
} from "@/lib/legends/academyContent";
import { eliteLevels, eliteLessonCount } from "@/lib/legends/eliteContent";
import { marketingCards, type MarketingCard } from "@/lib/legends/marketingContent";
import {
  academyTrainingAssets,
  trainingAssetIndex,
} from "@/lib/legends/trainingAssets";
import { AiAdvantageLibrary } from "@/components/training/AiAdvantageLibrary";
import { LocalTrainingAssetBrowser } from "@/components/training/LocalTrainingAssetBrowser";
import PlaybooksPanel from "@/components/training/PlaybooksPanel";
import { cn } from "@/lib/utils";

// ── Podcast library ──────────────────────────────────────────────────────────
// Episode metadata ported from Jeremy's Elite Sales & Marketing source
// material. Audio streams directly from the public Supabase Storage bucket —
// these are the live production encodes, not placeholders. The data lives in
// this file because the Resources surface is its only consumer.

const PODCAST_AUDIO_BASE =
  "https://ajitnzvbplyjrlzwzmwe.supabase.co/storage/v1/object/public/podcasts/";

const podcastAudioUrl = (file: string) =>
  `${PODCAST_AUDIO_BASE}${encodeURIComponent(file)}`;

const PODCAST_CATEGORIES = [
  "Sales Psychology",
  "Realtor Relationships",
  "Community Marketing",
  "Foreign Language Community Growth",
  "Pipeline Systems",
  "Mortgage Strategy",
  "AI and Automation",
  "Mindset and Discipline",
] as const;

type PodcastCategory = (typeof PODCAST_CATEGORIES)[number];

interface PodcastEpisode {
  slug: string;
  title: string;
  category: PodcastCategory;
  summary: string;
  takeaways: string[];
  action: string;
  file: string;
}

const ep = (
  file: string,
  title: string,
  category: PodcastCategory,
  summary: string,
  takeaways: string[],
  action: string
): PodcastEpisode => ({
  slug: file.replace(/\.m4a$/, "").toLowerCase().replace(/_/g, "-"),
  title,
  category,
  summary,
  takeaways,
  action,
  file,
});

const podcastEpisodes: PodcastEpisode[] = [
  ep(
    "Behavioral_Architecture_for_High_Stakes_Sales.m4a",
    "Behavioral Architecture for High-Stakes Sales",
    "Sales Psychology",
    "How to design your sales behavior on purpose — the structures, cues, and habits that hold up when the deal and the emotions are big.",
    [
      "High-stakes conversations reward preparation systems, not improvisation",
      "Behavior you architect in advance beats willpower in the moment",
      "Pressure exposes whatever process you didn't build",
    ],
    "Write the pre-call routine you will run before every high-stakes conversation this week."
  ),
  ep(
    "Build_an_unshakeable_TERA_pipeline_rhythm.m4a",
    "Build an Unshakeable TERA Pipeline Rhythm",
    "Pipeline Systems",
    "Installing a weekly pipeline rhythm that keeps prospecting, follow-up, and partner touches running no matter how busy file work gets.",
    [
      "A pipeline rhythm is a calendar commitment, not a to-do list",
      "Consistency in small weekly blocks compounds into predictable closings",
      "Busy file weeks are exactly when the rhythm matters most",
    ],
    "Block your pipeline rhythm into next week's calendar before Monday — then protect it."
  ),
  ep(
    "Building_a_Sane_Mortgage_Pipeline_Engine.m4a",
    "Building a Sane Mortgage Pipeline Engine",
    "Pipeline Systems",
    "Turning a chaotic pipeline into an engine: clear stages, next actions on every file, and a review cadence that removes the daily scramble.",
    [
      "Every deal needs a stage and a next action — no exceptions",
      "A sane pipeline is reviewed on a schedule, not when it hurts",
      "Systems lower stress and raise conversion at the same time",
    ],
    "Open your Deal Flow Tracker and fill in the next action for every active file."
  ),
  ep(
    "Building_local_authority_through_compliant_content.m4a",
    "Building Local Authority Through Compliant Content",
    "Community Marketing",
    "Becoming the known local expert with content that educates your market — while staying inside compliance lines.",
    [
      "Local authority is built by answering real local questions consistently",
      "Compliant educational content outlasts hype content",
      "Authority compounds: each piece makes the next referral warmer",
    ],
    "Publish one locally-focused educational piece this week — a question your buyers actually asked."
  ),
  ep(
    "Building_Trust_in_Russian_Speaking_Communities.m4a",
    "Building Trust in Russian-Speaking Communities",
    "Foreign Language Community Growth",
    "What it takes to earn and keep trust in Russian-speaking communities — language, presence, and serving in cultural context.",
    [
      "Trust in close-knit communities is earned in person and kept by reputation",
      "Serving in someone's language is a service, not a marketing tactic",
      "One well-served family opens an entire network",
    ],
    "Identify one community connector you can serve this month — without asking for anything."
  ),
  ep(
    "Close_40_million_with_110_contacts.m4a",
    "Close $40 Million with 110 Contacts",
    "Pipeline Systems",
    "Why a small, deeply-served database can out-produce a huge cold list — depth of relationship over breadth of contacts.",
    [
      "Production comes from relationship depth, not contact count",
      "A served database refers; a stored database forgets you",
      "Knowing 110 people well is a system, not an accident",
    ],
    "List your top 25 relationships and schedule a real touch for each over the next 30 days."
  ),
  ep(
    "Close_More_Loans_By_Shrinking_Your_Database.m4a",
    "Close More Loans by Shrinking Your Database",
    "Pipeline Systems",
    "The counterintuitive move: cut the dead weight, focus on the contacts you can genuinely serve, and watch conversion rise.",
    [
      "A smaller list you actually work beats a big list you ignore",
      "Pruning forces clarity about who your real relationships are",
      "Service capacity is finite — point it at the right people",
    ],
    "Cut your database to the people you can genuinely serve this quarter; archive the rest."
  ),
  ep(
    "Community_Is_Your_Ultimate_Competitive_Advantage.m4a",
    "Community Is Your Ultimate Competitive Advantage",
    "Community Marketing",
    "Why the lender who belongs to the community beats the lender with the bigger ad budget — and how to actually belong.",
    [
      "Community presence is a moat no competitor can copy quickly",
      "Belonging means contributing before extracting",
      "The obvious local lender wins deals that never go to bidding",
    ],
    "Pick the one community you'll genuinely belong to this year and show up this week."
  ),
  ep(
    "Community_Trust_Beats_Massive_Ad_Budgets.m4a",
    "Community Trust Beats Massive Ad Budgets",
    "Community Marketing",
    "Trust built face-to-face in a community outperforms paid reach — the economics and the playbook.",
    [
      "Earned trust converts at rates paid ads never reach",
      "Consistent presence beats sporadic sponsorship",
      "Your reputation is the cheapest media you'll ever own",
    ],
    "Replace one ad-spend hour this week with one in-person community hour. Compare what comes back."
  ),
  ep(
    "Daily_habits_for_a_Michelin_star_mortgage.m4a",
    "Daily Habits for a Michelin-Star Mortgage Practice",
    "Mindset and Discipline",
    "Running your practice like a top kitchen: daily prep, standards that never slip, and excellence as a habit rather than an event.",
    [
      "Excellence is a daily standard, not a big-moment performance",
      "Mise en place for an LO: prep tomorrow's calls today",
      "Small daily disciplines are what clients experience as 'quality'",
    ],
    "Write your daily non-negotiables — three of them — and run them every working day this week."
  ),
  ep(
    "Double_your_mortgage_pipeline_by_talking_less.m4a",
    "Double Your Mortgage Pipeline by Talking Less",
    "Sales Psychology",
    "The listening-to-talking ratio that wins borrowers: diagnostic questions, real silence, and letting the client sell themselves.",
    [
      "The person asking questions controls the conversation",
      "Silence after a question is where the real answer arrives",
      "Borrowers commit to plans they helped build",
    ],
    "On your next three borrower calls, track your talk time — aim to stay under 40%."
  ),
  ep(
    "Engineered_Systems_for_Mortgage_Realtor_Partnerships.m4a",
    "Engineered Systems for Mortgage-Realtor Partnerships",
    "Realtor Relationships",
    "Moving agent relationships from vibes to systems: defined touchpoints, value cadence, and partnership standards that scale.",
    [
      "Partnerships survive on systems, not memory",
      "Define the value cadence: what every partner gets, and when",
      "Engineered consistency is what top agents call 'reliability'",
    ],
    "Build the touch cadence for your top five agents into your Realtor Relationship Tracker now."
  ),
  ep(
    "Hispanic_Buyers_Drive_All_Housing_Growth.m4a",
    "Hispanic Buyers Drive Housing Growth",
    "Foreign Language Community Growth",
    "The demographic reality: Hispanic households are the engine of homeownership growth — and what serving that market well requires.",
    [
      "The growth market is already in your backyard",
      "Serving the market means language, trust, and family-centered process",
      "Early movers in underserved markets become the default lender",
    ],
    "Map the Hispanic community organizations in your market and pick one to connect with this month."
  ),
  ep(
    "How_Russian_loan_officers_beat_big_banks.m4a",
    "How Russian-Speaking Loan Officers Beat Big Banks",
    "Foreign Language Community Growth",
    "Why community LOs win against big-bank pricing: trust, speed, language, and being personally accountable to a community.",
    [
      "Banks have rates; community LOs have relationships and accountability",
      "In-language guidance removes the fear big banks can't address",
      "Community reputation is a referral engine banks can't buy",
    ],
    "Write down the three things you offer that a big bank cannot — and say them on your next call."
  ),
  ep(
    "How_Trust_Powers_the_Hispanic_Market.m4a",
    "How Trust Powers the Hispanic Market",
    "Foreign Language Community Growth",
    "Trust as the core currency in Hispanic homebuying — multigenerational decisions, family advisors, and the LO's role inside that circle.",
    [
      "The buying decision often includes the whole family — serve the whole family",
      "Trust travels: one well-served household becomes a referral network",
      "Patience with first-generation buyers builds decade-long clients",
    ],
    "Adjust your consult to welcome family decision-makers instead of working around them."
  ),
  ep(
    "Scaling_business_through_Vietnamese_community_trust.m4a",
    "Scaling Business Through Vietnamese Community Trust",
    "Foreign Language Community Growth",
    "How deep roots in the Vietnamese community scale into a durable mortgage business — presence, patience, and reputation.",
    [
      "Community trust scales through reputation, not advertising",
      "Show up at the community's events, not just your own",
      "Long loyalty cycles reward the LO who stays present",
    ],
    "Add the next three Vietnamese community events in your market to your calendar."
  ),
  ep(
    "Scaling_Community_Trust_With_AI.m4a",
    "Scaling Community Trust with AI",
    "AI and Automation",
    "Using AI to extend — not replace — community trust: in-language follow-ups, content leverage, and freeing hours for face time.",
    [
      "AI should buy you more human hours, not replace them",
      "In-language communication at scale is now possible for one LO",
      "Automate the admin; never automate the relationship",
    ],
    "Pick one repetitive communication task and hand it to AI this week — spend the saved hour in the community."
  ),
  ep(
    "Stop_Shaking_the_Referral_Vending_Machine.m4a",
    "Stop Shaking the Referral Vending Machine",
    "Realtor Relationships",
    "Why 'got anything for me?' kills agent relationships — and the value-first approach that makes referrals automatic.",
    [
      "Asking for referrals without depositing value is extraction",
      "Partners refer when you solve their problems, not when you ask harder",
      "Be the lender agents brag about, not the one they dodge",
    ],
    "Before your next referral ask, make three genuine value deposits with that partner."
  ),
  ep(
    "Why_Mortgages_Are_Not_a_Numbers_Game.m4a",
    "Why Mortgages Are Not a Numbers Game",
    "Sales Psychology",
    "Against pure volume thinking: mortgages are a trust business where conversion quality beats activity quantity.",
    [
      "Ten deep conversations beat a hundred shallow dials",
      "Clients buy certainty and care, not spreadsheets",
      "Measure relationships advanced, not just calls made",
    ],
    "Review last week's activity: which numbers actually moved relationships forward? Do more of those."
  ),
  ep(
    "Why_Your_Client_Rejected_the_Math.m4a",
    "Why Your Client Rejected the Math",
    "Sales Psychology",
    "The deal made financial sense and they still said no — the emotional logic underneath every borrower decision.",
    [
      "People decide emotionally and justify with math, not the reverse",
      "Address the fear before you present the figures",
      "A confused or scared client says no to a 'perfect' deal",
    ],
    "On your next presentation, name the client's biggest fear out loud before showing numbers."
  ),
  ep(
    "Why_Your_Plan_B_is_Dangerous.m4a",
    "Why Your Plan B Is Dangerous",
    "Mindset and Discipline",
    "How a comfortable fallback quietly drains the commitment your primary plan needs to work.",
    [
      "Energy split between Plan A and Plan B weakens both",
      "Commitment changes behavior in ways optionality never will",
      "Burn the boats on the goals that matter",
    ],
    "Name the escape hatch you're keeping open — and decide this week whether to close it."
  ),
  ep(
    "Win_Realtors_with_Experience_Architecture.m4a",
    "Win Realtors with Experience Architecture",
    "Realtor Relationships",
    "Designing the agent experience end-to-end — communication standards, surprise moments, and a process agents want to attach their name to.",
    [
      "Agents refer the experience, not the rate sheet",
      "Design every touchpoint an agent has with your process",
      "Predictability plus occasional delight equals loyalty",
    ],
    "Map every touchpoint an agent has with you on one deal — fix the weakest one this week."
  ),
  ep(
    "Win_the_first_call_borrower_conversion.m4a",
    "Win the First-Call Borrower Conversion",
    "Sales Psychology",
    "The first borrower call decides the relationship: structure, trust-building, and converting inquiry into commitment.",
    [
      "The first call sets the frame for the entire deal",
      "Diagnose before you prescribe — questions first, options second",
      "End every first call with a clear, scheduled next step",
    ],
    "Script your first-call structure: opener, three diagnostic questions, and the close for the next step."
  ),
  ep(
    "Winning_the_multigenerational_mortgage_market.m4a",
    "Winning the Multigenerational Mortgage Market",
    "Mortgage Strategy",
    "Multigenerational households are a growing share of purchases — structuring deals and conversations for buyers who decide as a family.",
    [
      "Multigenerational buying is a strategy opportunity, not a complication",
      "The LO who can structure for extended families wins unique deals",
      "Family-decision processes need patience and clear education",
    ],
    "Learn the loan structures that fit multigenerational purchases and add one to your toolkit this month."
  ),
  ep(
    "Winning_the_Punjabi_American_Mortgage_Market.m4a",
    "Winning the Punjabi-American Mortgage Market",
    "Foreign Language Community Growth",
    "Serving Punjabi-American buyers well: community presence, family-centered deals, and trust built the long way.",
    [
      "Community events and gurdwara networks matter more than ads",
      "Family and business assets often shape the file — learn the patterns",
      "Reputation in the community is the only marketing that scales here",
    ],
    "Find the Punjabi community hubs in your market and make one genuine connection this month."
  ),
  ep(
    "Winning_Vietnamese_mortgage_deals_through_trust.m4a",
    "Winning Vietnamese Mortgage Deals Through Trust",
    "Foreign Language Community Growth",
    "Earning Vietnamese-American clients: language, patience with documentation patterns, and becoming the community's trusted advisor.",
    [
      "Trust is referred person-to-person — earn it one family at a time",
      "Understand the community's documentation and savings patterns",
      "The trusted advisor gets the whole network, not just the deal",
    ],
    "Ask your best Vietnamese-American client what made them trust you — then do more of that on purpose."
  ),
];

// ── Shared link card ─────────────────────────────────────────────────────────

function LinkCard({ link }: { link: ResourceLink }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-100">
          {link.title}
        </h3>
        {link.external && (
          <ArrowUpRight
            size={15}
            className="mt-0.5 shrink-0 text-accent-champagne/70 transition group-hover:text-accent-champagne"
          />
        )}
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-600 dark:text-ink-300">
        {link.description}
      </p>
    </>
  );

  const className =
    "group glass-card-padded block transition hover:-translate-y-0.5 hover:border-accent-champagne/30";

  if (link.external) {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {body}
      </a>
    );
  }

  return (
    <Link href={link.href} className={className}>
      {body}
    </Link>
  );
}

// ── Tab panels ───────────────────────────────────────────────────────────────

function CalendarPanel() {
  return (
    <div className="space-y-4">
      <div className="glass-card-padded">
        <p className="label flex items-center gap-1.5">
          <CalendarDays size={12} className="text-accent-champagne" /> Weekly
          coaching rhythm
        </p>
        <ul className="mt-3 divide-y divide-accent-champagne/10">
          {calendarItems.map((item) => (
            <li
              key={item.day}
              className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:gap-4"
            >
              <div className="flex w-full items-center justify-between gap-3 sm:w-44 sm:shrink-0">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent-champagne">
                  {item.day}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-500 dark:text-ink-400">
                  <Clock3 size={11} />
                  {item.time}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink-900 dark:text-ink-100">
                  {item.title}
                </p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-600 dark:text-ink-300">
                  {item.focus}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 rounded-xl border border-accent-champagne/20 bg-accent-champagne/5 px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-700 dark:text-ink-200">
          {calendarInviteNote}
        </p>
      </div>
    </div>
  );
}

function PodcastsPanel() {
  const [category, setCategory] = useState<"All" | PodcastCategory>("All");

  const categories = useMemo(() => {
    const present = PODCAST_CATEGORIES.filter((c) =>
      podcastEpisodes.some((e) => e.category === c)
    );
    return ["All" as const, ...present];
  }, []);

  const episodes =
    category === "All"
      ? podcastEpisodes
      : podcastEpisodes.filter((e) => e.category === category);

  return (
    <div className="space-y-4">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-thin">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={cn("shrink-0", c === category ? "chip-active" : "chip")}
          >
            {c}
            {c === "All" && ` · ${podcastEpisodes.length}`}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {episodes.map((episode) => (
          <article key={episode.slug} className="glass-card-padded">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="chip">{episode.category}</span>
                <h3 className="mt-2 text-sm font-semibold text-ink-900 dark:text-ink-100">
                  {episode.title}
                </h3>
              </div>
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-accent-champagne/25 bg-ink-950/40 text-accent-champagne">
                <Headphones size={14} />
              </span>
            </div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-600 dark:text-ink-300">
              {episode.summary}
            </p>
            <ul className="mt-2.5 space-y-1">
              {episode.takeaways.map((t) => (
                <li
                  key={t}
                  className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-600 dark:text-ink-300"
                >
                  <span
                    aria-hidden
                    className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent-champagne/70"
                  />
                  {t}
                </li>
              ))}
            </ul>
            <p className="mt-2.5 text-[12px] leading-relaxed text-ink-700 dark:text-ink-200">
              <span className="font-semibold text-accent-champagne">
                Action:
              </span>{" "}
              {episode.action}
            </p>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption -- coaching audio; transcripts ship separately */}
            <audio
              controls
              preload="none"
              src={podcastAudioUrl(episode.file)}
              className="mt-3 w-full"
            />
          </article>
        ))}
      </div>
    </div>
  );
}

function MarketingCardView({ card }: { card: MarketingCard }) {
  const [open, setOpen] = useState(false);

  return (
    <article className="glass-card-padded">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="chip">{card.category}</span>
          <span className="chip">Level {card.level}</span>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-500 dark:text-ink-400">
            <Clock3 size={11} />
            {card.estimatedTime}
          </span>
        </div>
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-accent-champagne/25 bg-ink-950/40 text-accent-champagne">
          <Megaphone size={14} />
        </span>
      </div>
      <h3 className="mt-2.5 text-sm font-semibold text-ink-900 dark:text-ink-100">
        {card.title}
      </h3>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-600 dark:text-ink-300">
        {card.description}
      </p>
      <ul className="mt-2.5 space-y-1">
        {card.topics.map((topic) => (
          <li
            key={topic}
            className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-600 dark:text-ink-300"
          >
            <span
              aria-hidden
              className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent-champagne/70"
            />
            {topic}
          </li>
        ))}
      </ul>
      <p className="mt-2.5 text-[12px] leading-relaxed text-ink-700 dark:text-ink-200">
        <span className="font-semibold text-accent-champagne">Start here:</span>{" "}
        {card.nextAction}
      </p>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-700 transition hover:text-accent-champagne dark:text-ink-200"
      >
        Checklist, mistakes &amp; AI prompt
        <ChevronDown
          size={14}
          className={cn("transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="mt-3 space-y-4 border-t border-ink-200 pt-3 dark:border-ink-800">
          <div>
            <p className="label flex items-center gap-1.5">
              <CheckCircle2 size={12} className="text-accent-champagne" />
              Success checklist
            </p>
            <ul className="mt-2 space-y-1">
              {card.successChecklist.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-600 dark:text-ink-300"
                >
                  <span
                    aria-hidden
                    className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent-champagne/70"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="label flex items-center gap-1.5">
              <XCircle size={12} className="text-accent-champagne" />
              Common mistakes
            </p>
            <ul className="mt-2 space-y-1">
              {card.commonMistakes.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-600 dark:text-ink-300"
                >
                  <span
                    aria-hidden
                    className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent-champagne/70"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="label flex items-center gap-1.5">
              <Sparkles size={12} className="text-accent-champagne" />
              {card.aiPrompt.title}
            </p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-ink-600 dark:text-ink-300">
              {card.aiPrompt.useCase}
            </p>
            <p className="mt-2 rounded-xl border border-ink-200 bg-white/40 px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-ink-700 dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-200">
              {card.aiPrompt.promptStarter}
            </p>
          </div>
          {card.complianceCaution && (
            <p className="rounded-xl border border-status-warn/30 bg-status-warn/5 px-3 py-2.5 text-[12px] leading-relaxed text-ink-700 dark:text-ink-200">
              <span className="font-semibold">Compliance caution:</span>{" "}
              {card.complianceCaution}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

function MarketingPanel() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {marketingCards.map((card) => (
        <MarketingCardView key={card.id} card={card} />
      ))}
    </div>
  );
}

function ElitePanel() {
  // Top-of-level lesson preview — the first lesson from each of the six levels.
  const preview = eliteLevels.map((level) => ({
    level,
    lesson: level.lessons[0],
  }));

  return (
    <div className="space-y-4">
      <Link
        href="/training/elite"
        className="group glass-card-padded block transition hover:-translate-y-0.5 hover:border-accent-champagne/30"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent-champagne/25 bg-ink-950/40 text-accent-champagne">
              <GraduationCap size={18} />
            </span>
            <div className="min-w-0 max-w-2xl">
              <h3 className="text-base font-semibold text-ink-900 dark:text-ink-100">
                Elite Sales &amp; Marketing
              </h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-600 dark:text-ink-300">
                {eliteLevels.length} levels, {eliteLessonCount} lessons — from
                101 Foundation through 601 Elite Execution. Each level carries a
                do-this-today list, a weekly assignment, and tracker metrics
                reviewed on the weekly group coaching call.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-accent-champagne">
            Open the library
            <ArrowRight
              size={14}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </span>
        </div>
      </Link>

      <div className="section-title">
        <h2>Top lessons by level</h2>
        <p>The opening lesson of each level — start at 101 and move up.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {preview.map(({ level, lesson }) => (
          <Link
            key={level.level}
            href="/training/elite"
            className="group glass-card-padded block transition hover:-translate-y-0.5 hover:border-accent-champagne/30"
          >
            <div className="flex items-center gap-2">
              <span className="chip">{lesson.category}</span>
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-ink-500 dark:text-ink-400">
                Level {level.level}
              </span>
            </div>
            <h4 className="mt-2.5 text-[13.5px] font-semibold leading-snug text-ink-900 dark:text-ink-100">
              {lesson.title}
            </h4>
            <p className="mt-1 text-[11.5px] leading-relaxed text-ink-500 dark:text-ink-400">
              {level.corePromise}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Resources hub ────────────────────────────────────────────────────────────
// Tab state syncs with the ?tab= search param so other surfaces can deep-link
// (e.g. /training/resources?tab=elite). The page is force-dynamic, so
// useSearchParams is safe here.

export function AcademyResources({ firstName }: { firstName: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const paramKey = searchParams.get("tab");
  const fallbackKey = resourceTabs[0]?.key ?? "";
  const initialKey = resourceTabs.some((t) => t.key === paramKey)
    ? (paramKey as string)
    : fallbackKey;

  const [activeKey, setActiveKey] = useState(initialKey);

  // Keep state in sync when the param changes (back/forward, external links).
  useEffect(() => {
    if (paramKey && resourceTabs.some((t) => t.key === paramKey)) {
      setActiveKey(paramKey);
    }
  }, [paramKey]);

  const activeTab =
    resourceTabs.find((tab) => tab.key === activeKey) ?? resourceTabs[0];

  if (!activeTab) return null;

  const selectTab = (key: string) => {
    setActiveKey(key);
    router.replace(`${pathname}?tab=${key}`, { scroll: false });
  };

  return (
    <div className="space-y-5">
      {/* Tab rail */}
      <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-thin">
        {resourceTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => selectTab(tab.key)}
            className={
              "shrink-0 " + (tab.key === activeKey ? "chip-active" : "chip")
            }
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Active tab */}
      <section className="space-y-4">
        <div className="section-title">
          <h2>{activeTab.label}</h2>
          <p>
            {firstName ? `${firstName}, ` : ""}
            {activeTab.blurb}
          </p>
        </div>

        {activeTab.key === "calendar" && <CalendarPanel />}
        {activeTab.key === "playbooks" && <PlaybooksPanel />}
        {activeTab.key === "podcasts" && <PodcastsPanel />}
        {activeTab.key === "marketing" && <MarketingPanel />}
        {activeTab.key === "elite" && <ElitePanel />}

        {activeTab.key === "training" && (
          <LocalTrainingAssetBrowser
            assets={academyTrainingAssets}
            counts={trainingAssetIndex.counts}
            driveLinks={trainingAssetIndex.driveLinks}
            title="Training asset index"
            description="Curriculum, AI training, audio, transcripts, scripts, and coaching references from the indexed training corpus."
            maxVisible={24}
            compact
          />
        )}

        {activeTab.key === "ai-advantage" && <AiAdvantageLibrary />}

        {/* Link cards */}
        {activeTab.links.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activeTab.links.map((link) => (
              <LinkCard key={link.href + link.title} link={link} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

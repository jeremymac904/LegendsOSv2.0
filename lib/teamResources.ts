import type { SharedResource } from "@/types/database";

export const LF_TRAINING_FOLDER_URL =
  "https://drive.google.com/drive/folders/164oRV4Vn1XRh6UTySL52USyXDugfQp6a?usp=sharing";

export const TRAINING_RESOURCE_TYPE = "training_item";
export const MARKETING_RESOURCE_TYPE = "marketing_material";
export const LF_RESOURCE_TYPE = "lf_resource";

export type TeamResourceMode = "training" | "marketing" | "lf";

export interface TeamResourceDetailSection {
  title: string;
  body?: string;
  items?: string[];
}

export interface TeamResourceCopyBlock {
  title: string;
  body: string;
}

export interface TeamResourceDetail {
  summary?: string;
  objective?: string;
  useCase?: string;
  includedAssets?: string[];
  steps?: string[];
  sections?: TeamResourceDetailSection[];
  copyBlocks?: TeamResourceCopyBlock[];
  complianceNote?: string;
  nextSteps?: string[];
  relatedIds?: string[];
}

export interface TeamResourceItem {
  id: string;
  title: string;
  description: string;
  category: string;
  resourceType: string;
  url: string | null;
  embedUrl: string | null;
  thumbnailUrl: string | null;
  durationMinutes: number | null;
  audience: string | null;
  tags: string[];
  format: string | null;
  intendedUse: string | null;
  instructions: string | null;
  department: string | null;
  detail?: TeamResourceDetail;
  source: "default" | "shared";
  updatedAt: string | null;
}

export const TRAINING_CATEGORIES = [
  "LegendsOS Basics",
  "Atlas Training",
  "n8n Setup",
  "Google Workspace",
  "Social Media",
  "Image Studio",
  "Email Newsletters",
  "Mortgage Coaching",
  "Sales Coaching",
  "Loan Factory Systems",
  "AI Tools",
];

export const MARKETING_CATEGORIES = [
  "Webinar Templates",
  "First Time Homebuyer",
  "Real Estate Agent Guides",
  "YouTube & Podcast Topics",
  "Seminar Materials",
  "Buyer Education",
  "Realtor Co-Branded",
  "Email Newsletters",
  "Social Campaign Packs",
  "Open House Materials",
  "Listing Marketing",
  "Presentation Outlines",
  "Script Templates",
];

export const LF_RESOURCE_CATEGORIES = [
  "Loan Factory Training",
  "Loan Officer Support",
  "LO Development",
  "Corporate Coaching",
  "Training Academy",
  "Marketing Department",
  "Loan Factory System Links",
  "Important Forms",
  "n8n and LegendsOS Setup",
  "Google Workspace Setup",
  "Lender Escalation Resources",
  "Post Onboarding Check In",
  "Department Feedback",
  "AI Training Resources",
];

export function youtubeEmbedUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  try {
    const url = new URL(input);
    const host = url.hostname.replace(/^www\./, "");
    let id: string | null = null;
    if (host === "youtu.be") {
      id = url.pathname.split("/").filter(Boolean)[0] ?? null;
    } else if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname === "/watch") id = url.searchParams.get("v");
      if (url.pathname.startsWith("/embed/")) {
        id = url.pathname.split("/").filter(Boolean)[1] ?? null;
      }
      if (url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/live/")) {
        id = url.pathname.split("/").filter(Boolean)[1] ?? null;
      }
    }
    if (!id || !/^[a-zA-Z0-9_-]{6,}$/.test(id)) return null;
    return `https://www.youtube.com/embed/${id}`;
  } catch {
    return null;
  }
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function sectionList(value: unknown): TeamResourceDetailSection[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const sections = value
    .map((entry): TeamResourceDetailSection | null => {
      if (!entry || typeof entry !== "object") return null;
      const candidate = entry as Record<string, unknown>;
      const title = stringValue(candidate.title);
      if (!title) return null;
      return {
        title,
        body: stringValue(candidate.body) ?? undefined,
        items: stringList(candidate.items),
      };
    })
    .filter((entry): entry is TeamResourceDetailSection => Boolean(entry));
  return sections.length ? sections : undefined;
}

function copyBlockList(value: unknown): TeamResourceCopyBlock[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const blocks = value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const candidate = entry as Record<string, unknown>;
      const title = stringValue(candidate.title);
      const body = stringValue(candidate.body);
      if (!title || !body) return null;
      return { title, body };
    })
    .filter((entry): entry is TeamResourceCopyBlock => Boolean(entry));
  return blocks.length ? blocks : undefined;
}

function detailFromPayload(payload: Record<string, unknown>): TeamResourceDetail | undefined {
  const detail = payload.detail;
  if (!detail || typeof detail !== "object") return undefined;
  const source = detail as Record<string, unknown>;
  const includedAssets = stringList(source.included_assets ?? source.includedAssets);
  const steps = stringList(source.steps);
  const nextSteps = stringList(source.next_steps ?? source.nextSteps);
  const relatedIds = stringList(source.related_ids ?? source.relatedIds);
  const parsed: TeamResourceDetail = {
    summary: stringValue(source.summary) ?? undefined,
    objective: stringValue(source.objective) ?? undefined,
    useCase: stringValue(source.use_case) ?? stringValue(source.useCase) ?? undefined,
    includedAssets: includedAssets.length ? includedAssets : undefined,
    steps: steps.length ? steps : undefined,
    sections: sectionList(source.sections),
    copyBlocks: copyBlockList(source.copy_blocks ?? source.copyBlocks),
    complianceNote:
      stringValue(source.compliance_note) ?? stringValue(source.complianceNote) ?? undefined,
    nextSteps: nextSteps.length ? nextSteps : undefined,
    relatedIds: relatedIds.length ? relatedIds : undefined,
  };
  return Object.values(parsed).some(Boolean) ? parsed : undefined;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function resourceFromShared(row: SharedResource): TeamResourceItem {
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  const url = stringValue(payload.url) ?? stringValue(payload.video_url);
  const embedUrl =
    stringValue(payload.embed_url) ??
    youtubeEmbedUrl(stringValue(payload.video_url) ?? url);
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? stringValue(payload.description) ?? "",
    category: stringValue(payload.category) ?? "Team Shared",
    resourceType: stringValue(payload.resource_type) ?? row.resource_type,
    url,
    embedUrl,
    thumbnailUrl: stringValue(payload.thumbnail_url),
    durationMinutes: numberValue(payload.duration_minutes),
    audience: stringValue(payload.audience),
    tags: stringList(payload.tags),
    format: stringValue(payload.format),
    intendedUse: stringValue(payload.intended_use),
    instructions: stringValue(payload.instructions) ?? stringValue(payload.body),
    department: stringValue(payload.department),
    detail: detailFromPayload(payload),
    source: "shared",
    updatedAt: row.updated_at,
  };
}

export const DEFAULT_TRAINING_ITEMS: TeamResourceItem[] = [
  {
    id: "lf-training-folder",
    title: "Loan Factory Training Folder",
    description:
      "Top-level Jeremy and Andre Drive folder for Loan Factory training, AI resources, team systems, and setup material.",
    category: "Loan Factory Systems",
    resourceType: "drive_folder",
    url: LF_TRAINING_FOLDER_URL,
    embedUrl: null,
    thumbnailUrl: null,
    durationMinutes: null,
    audience: "All team members",
    tags: ["Loan Factory", "training", "Google Drive"],
    format: "Drive folder",
    intendedUse: "Start here when looking for LF training source material.",
    instructions: "Open the folder, then add the best videos and docs as team-shared training items.",
    department: "Loan Factory",
    detail: {
      summary:
        "Internal landing page for the provided Loan Factory source folder. Use this page first to understand what belongs in the training library, then open Drive only when you need the raw files.",
      sections: [
        {
          title: "What this includes",
          items: [
            "Loan Factory training source material",
            "AI and workflow training references",
            "Jeremy and Andre shared operating resources",
          ],
        },
        {
          title: "How to use it",
          items: [
            "Find the relevant topic in LegendsOS first.",
            "Open the source folder only when you need the original file.",
            "Promote high-value videos or documents into individual Training cards.",
          ],
        },
      ],
      nextSteps: [
        "Owner: add the most-used videos as dedicated training items.",
        "Loan officer: start with the matching internal Training card before browsing Drive.",
      ],
    },
    source: "default",
    updatedAt: null,
  },
  {
    id: "training-knowledge",
    title: "Training Knowledge",
    description:
      "Drive folder containing LF AI training, marketing systems, LO help, training nuggets, and walkthrough assets.",
    category: "AI Tools",
    resourceType: "drive_folder",
    url: "https://drive.google.com/drive/folders/1OKRvYZN6zNP7oBLv6uKDt8c-Hka8HOUg",
    embedUrl: null,
    thumbnailUrl: null,
    durationMinutes: null,
    audience: "LOs and team operators",
    tags: ["AI training", "walkthroughs", "nuggets"],
    format: "Drive folder",
    intendedUse: "Organize into individual training videos and quick tutorials.",
    instructions: "Use this as the source folder for new Training cards.",
    department: "Training",
    detail: {
      summary:
        "A staging area for training knowledge that should become smaller, searchable LegendsOS lessons.",
      sections: [
        {
          title: "Best fit",
          items: [
            "AI workflow training",
            "Marketing system walkthroughs",
            "Short LO help topics that are asked repeatedly",
          ],
        },
        {
          title: "Publishing standard",
          items: [
            "Each converted item should teach one workflow.",
            "Add a next action and related resource.",
            "Use a YouTube embed when possible, and keep Drive as the source link.",
          ],
        },
      ],
      nextSteps: ["Convert the top recurring support question into a Training nugget."],
    },
    source: "default",
    updatedAt: null,
  },
  {
    id: "training-site",
    title: "Loan Factory Training Site",
    description:
      "Drive-backed training site assets for Loan Factory onboarding and systems walkthroughs.",
    category: "Loan Factory Systems",
    resourceType: "drive_folder",
    url: "https://drive.google.com/drive/folders/1xC82SiXdXA9piA8KIdyGQAVQyuNGtdHU",
    embedUrl: null,
    thumbnailUrl: null,
    durationMinutes: null,
    audience: "Loan officers",
    tags: ["systems", "onboarding"],
    format: "Drive folder",
    intendedUse: "Reference official LF workflow training.",
    instructions: "Open the source folder and add priority videos as training items.",
    department: "Training Academy",
    detail: {
      summary:
        "Official Loan Factory workflow training source. This page keeps the context inside LegendsOS before sending the user to Drive.",
      sections: [
        {
          title: "When to use it",
          items: [
            "Onboarding a new LO",
            "Refreshing a Loan Factory systems workflow",
            "Finding official process training before asking for help",
          ],
        },
      ],
      nextSteps: [
        "Review the internal Training cards first.",
        "Open the source folder when you need the official underlying file.",
      ],
    },
    source: "default",
    updatedAt: null,
  },
  {
    id: "training-nuggets",
    title: "Training Nugget System",
    description:
      "Short-form training nugget folder for quick tutorials and repeatable operational tips.",
    category: "LegendsOS Basics",
    resourceType: "drive_folder",
    url: "https://drive.google.com/drive/folders/1Mls39pZJUwWaUjOI9Ibdmk3BANUl11a6",
    embedUrl: null,
    thumbnailUrl: null,
    durationMinutes: null,
    audience: "All team members",
    tags: ["quick tutorial", "nuggets"],
    format: "Drive folder",
    intendedUse: "Convert short tutorials into Training cards.",
    instructions: "Keep nuggets short and focused on one repeatable action.",
    department: "Training",
    detail: {
      summary:
        "Short lessons for one action, one habit, or one support answer. The ideal training nugget should be usable in under five minutes.",
      steps: [
        "Pick one task or decision.",
        "Record or link the shortest useful walkthrough.",
        "Add the expected outcome and the next action.",
        "Tag it so Atlas and loan officers can find it later.",
      ],
      nextSteps: ["Owner: add new nuggets whenever a support question repeats."],
    },
    source: "default",
    updatedAt: null,
  },
  {
    id: "ai-roadmap",
    title: "AI Training Roadmap",
    description:
      "Roadmap PDF for AI training rollout and team adoption planning.",
    category: "AI Tools",
    resourceType: "pdf",
    url: "https://drive.google.com/file/d/1NTslE43SAQEqbhRGjkm9KkHY8IXq1OnW/view?usp=drivesdk",
    embedUrl: null,
    thumbnailUrl: null,
    durationMinutes: null,
    audience: "Owner, admins, trainers",
    tags: ["AI", "roadmap", "training plan"],
    format: "PDF",
    intendedUse: "Use as planning context for the next AI training sequence.",
    instructions: "Review before publishing new AI training modules.",
    department: "AI Training",
    detail: {
      summary:
        "Planning context for the team AI training rollout. Use it to decide what to teach next and how to sequence the material.",
      sections: [
        {
          title: "Use this for",
          items: [
            "AI adoption planning",
            "Training calendar decisions",
            "Prioritizing which Atlas, Image Studio, and n8n lessons should ship first",
          ],
        },
      ],
      nextSteps: [
        "Turn roadmap priorities into Training items.",
        "Attach supporting docs to Knowledge Sources when Atlas should reference them.",
      ],
    },
    source: "default",
    updatedAt: null,
  },
];

export const DEFAULT_MARKETING_MATERIALS: TeamResourceItem[] = [
  {
    id: "marketing-project-folder",
    title: "Marketing & Recruiting Project Folder",
    description:
      "Loan Factory Drive folder for marketing and recruiting source assets.",
    category: "Presentation Outlines",
    resourceType: "drive_folder",
    url: "https://drive.google.com/drive/folders/1V_ozOmfaW4wgmivhQ81sz7EOoql5M9Z5",
    embedUrl: null,
    thumbnailUrl: null,
    durationMinutes: null,
    audience: "Owner and marketing users",
    tags: ["marketing", "recruiting", "Drive"],
    format: "Drive folder",
    intendedUse: "Source review decks and campaign planning files.",
    instructions: "Open the source folder and duplicate approved assets into LO-facing materials.",
    department: "Marketing Department",
    detail: {
      summary:
        "Source folder for marketing and recruiting assets. LegendsOS should be the primary working view; open Drive only when you need original files.",
      sections: [
        {
          title: "What belongs here",
          items: [
            "Approved marketing source files",
            "Recruiting and seminar material",
            "Campaign planning references for owner review",
          ],
        },
        {
          title: "Best practice",
          items: [
            "Turn frequently reused assets into Marketing Material cards.",
            "Keep the raw folder link secondary so loan officers start with guidance.",
            "Add customization notes before sharing any template with the team.",
          ],
        },
      ],
      nextSteps: ["Owner: promote the most-used files into dedicated internal materials."],
    },
    source: "default",
    updatedAt: null,
  },
  {
    id: "homebuyer-webinar-template",
    title: "First Time Homebuyer Webinar Template",
    description:
      "A webinar outline for buyer education, affordability, process expectations, and next steps.",
    category: "Webinar Templates",
    resourceType: "webinar_template",
    url: null,
    embedUrl: null,
    thumbnailUrl: null,
    durationMinutes: null,
    audience: "Loan officers",
    tags: ["homebuyer", "webinar", "buyer education"],
    format: "Outline",
    intendedUse: "Run local or virtual buyer education sessions.",
    instructions:
      "Customize the intro, market examples, call to action, and co-branded realtor section before sharing.",
    department: "Marketing Department",
    detail: {
      summary:
        "A ready-to-customize webinar framework for educating first-time buyers and creating follow-up consultations.",
      objective:
        "Help buyers understand the homebuying process, financing path, affordability basics, and next steps without overwhelming them.",
      useCase:
        "Use for Zoom webinars, local buyer classes, realtor partner events, and first-time homebuyer lead nurture.",
      includedAssets: [
        "Suggested slide outline",
        "Speaker note prompts",
        "Registration copy",
        "Email invitation copy",
        "Social post ideas",
        "Follow-up sequence",
      ],
      sections: [
        {
          title: "Target audience",
          items: [
            "First-time homebuyers",
            "Renters considering ownership",
            "Realtor partner audiences",
            "Past leads who need a simple re-entry point",
          ],
        },
        {
          title: "Suggested slide outline",
          items: [
            "Welcome and why preparation matters",
            "The loan journey from pre-approval to closing",
            "Down payment, credit, income, and affordability basics",
            "Common first-time buyer mistakes",
            "How to work with a realtor and lender as one team",
            "Next steps and consultation call to action",
          ],
        },
        {
          title: "Speaker notes",
          items: [
            "Keep examples local and plain-English.",
            "Explain that every buyer scenario is unique.",
            "Avoid rate promises or approval guarantees.",
            "Invite questions but route personal advice to a private consultation.",
          ],
        },
        {
          title: "Marketing plan",
          items: [
            "Announce 10 to 14 days before the event.",
            "Ask realtor partners to co-host or share.",
            "Post three social reminders and one day-of reminder.",
            "Send a registration confirmation and a replay/follow-up email.",
          ],
        },
      ],
      copyBlocks: [
        {
          title: "Registration copy",
          body:
            "Join us for a practical first-time homebuyer session covering the loan process, affordability basics, common mistakes, and the steps to get prepared before you shop.",
        },
        {
          title: "Email invitation",
          body:
            "Subject: First-time homebuyer class - what to know before you shop\n\nHi {{first_name}},\n\nI am hosting a short buyer education session for anyone thinking about buying a home. We will cover the financing process, preparation steps, common mistakes, and how to know what to do next. Reply if you want the registration link.",
        },
        {
          title: "Social post idea",
          body:
            "Thinking about buying your first home? I am hosting a practical buyer education session to walk through the loan process, affordability basics, and the next steps to get prepared. Message me for the registration link.",
        },
        {
          title: "Follow-up sequence",
          body:
            "Day 0: send replay and consultation CTA.\nDay 2: send buyer checklist.\nDay 5: invite questions.\nDay 10: ask whether they want a private pre-approval review.",
        },
      ],
      complianceNote:
        "Keep rates, payments, approvals, and program availability general unless reviewed for the specific scenario and current disclosures.",
      nextSteps: [
        "Copy the invitation into Email Studio.",
        "Create three event posts in Social Studio.",
        "Attach a buyer checklist or guide if one is approved.",
      ],
      relatedIds: ["first-time-homebuyer-guide", "buyer-education-handout", "presentation-outline"],
    },
    source: "default",
    updatedAt: null,
  },
  {
    id: "first-time-homebuyer-guide",
    title: "First Time Homebuyer Guide",
    description:
      "A plain-English buyer guide covering preparation, documents, pre-approval, shopping, contract, processing, and closing.",
    category: "First Time Homebuyer",
    resourceType: "homebuyer_guide",
    url: null,
    embedUrl: null,
    thumbnailUrl: null,
    durationMinutes: null,
    audience: "Loan officers and first-time buyers",
    tags: ["homebuyer", "guide", "education"],
    format: "Guide outline",
    intendedUse: "Create a downloadable guide or email nurture asset.",
    instructions:
      "Customize examples for the market, add brand-approved contact details, and avoid quoting rates or program promises.",
    department: "Marketing Department",
    detail: {
      summary:
        "A reusable buyer education guide that helps loan officers answer the same early-stage questions consistently.",
      includedAssets: [
        "Buyer readiness checklist",
        "Document list",
        "Process timeline",
        "Common mistake section",
        "Consultation CTA",
      ],
      sections: [
        {
          title: "Recommended guide sections",
          items: [
            "What pre-approval means",
            "Documents to gather",
            "Credit, income, and asset basics",
            "How offers and closing timelines work",
            "What happens after the contract is accepted",
          ],
        },
        {
          title: "Customization notes",
          items: [
            "Add local market examples.",
            "Include your preferred buyer consultation CTA.",
            "Use screenshots or diagrams only if they are approved and current.",
          ],
        },
      ],
      nextSteps: ["Copy the outline into a Google Doc or Canva template and brand it for the team."],
    },
    source: "default",
    updatedAt: null,
  },
  {
    id: "real-estate-agent-guide",
    title: "Real Estate Agent Guide",
    description:
      "Partner-facing guide that explains how loan officers support agents, buyers, offers, and closing timelines.",
    category: "Real Estate Agent Guides",
    resourceType: "agent_guide",
    url: null,
    embedUrl: null,
    thumbnailUrl: null,
    durationMinutes: null,
    audience: "Realtor partners",
    tags: ["agent", "realtor", "partner"],
    format: "Guide outline",
    intendedUse: "Use for realtor partner education and onboarding.",
    instructions:
      "Customize the partner value proposition and include clear collaboration expectations.",
    department: "Marketing Department",
    detail: {
      summary:
        "A realtor-facing partner guide that shows how the lending team helps buyers and agents move faster with fewer surprises.",
      sections: [
        {
          title: "Core sections",
          items: [
            "What a strong pre-approval includes",
            "How we support offer strategy",
            "Communication expectations after contract",
            "Common buyer financing questions agents ask",
            "How to co-market education events",
          ],
        },
      ],
      nextSteps: ["Use this as a leave-behind after realtor meetings or AI seminars."],
      relatedIds: ["agent-ai-seminar", "realtor-social-campaign-pack"],
    },
    source: "default",
    updatedAt: null,
  },
  {
    id: "agent-ai-seminar",
    title: "Real Estate AI Seminar Materials",
    description:
      "Seminar structure for teaching agents practical AI use cases without overpromising.",
    category: "Seminar Materials",
    resourceType: "seminar_deck",
    url: null,
    embedUrl: null,
    thumbnailUrl: null,
    durationMinutes: null,
    audience: "Loan officers and realtor partners",
    tags: ["AI", "realtors", "seminar"],
    format: "Seminar outline",
    intendedUse: "Host realtor value-add sessions.",
    instructions:
      "Pair with a compliant mortgage-safe image prompt and a local follow-up plan.",
    department: "Marketing Department",
    detail: {
      summary:
        "A practical AI seminar plan for realtor partners that creates value without turning the session into technical overload.",
      objective:
        "Teach agents realistic AI workflows they can use for listing prep, content planning, client education, follow-up, and productivity.",
      useCase:
        "Use for lunch-and-learn events, brokerage office training, realtor mastermind sessions, and partner nurture.",
      sections: [
        {
          title: "Target agents",
          items: [
            "Agents who want more consistent marketing",
            "Teams that need repeatable content systems",
            "Partners who want buyer and seller education ideas",
          ],
        },
        {
          title: "Slide outline",
          items: [
            "Why AI matters for agents now",
            "What AI should and should not do",
            "Listing content workflow",
            "Buyer education workflow",
            "Follow-up and CRM-safe prompt examples",
            "Mortgage-safe co-branded marketing ideas",
            "CTA: book a strategy session or co-host buyer education",
          ],
        },
        {
          title: "Demo ideas",
          items: [
            "Turn a listing feature list into three post concepts.",
            "Draft a buyer education carousel outline.",
            "Create a short video script from an open house scenario.",
            "Use Image Studio with brand and compliance guidance.",
          ],
        },
        {
          title: "Follow-up strategy",
          items: [
            "Send recap and prompt sheet within 24 hours.",
            "Offer a 15-minute co-marketing planning call.",
            "Invite the agent to co-host a buyer webinar.",
          ],
        },
      ],
      copyBlocks: [
        {
          title: "CTA",
          body:
            "Want help turning this into a simple marketing workflow for your listings or buyers? Reply and we can build a first campaign together.",
        },
      ],
      complianceNote:
        "Keep demos educational. Do not imply AI replaces professional review, compliance review, fair housing review, or loan-specific advice.",
      nextSteps: [
        "Use the Marketing Image Coach to plan visuals.",
        "Create a follow-up newsletter in Email Studio.",
        "Build a social recap post in Social Studio.",
      ],
      relatedIds: ["real-estate-agent-guide", "youtube-podcast-topic-template"],
    },
    source: "default",
    updatedAt: null,
  },
  {
    id: "youtube-podcast-topic-template",
    title: "YouTube and Podcast Topic Template",
    description:
      "Repeatable topic planning framework for buyer education, realtor education, market explainers, and short-form clips.",
    category: "YouTube & Podcast Topics",
    resourceType: "youtube_template",
    url: null,
    embedUrl: null,
    thumbnailUrl: null,
    durationMinutes: null,
    audience: "Loan officers",
    tags: ["youtube", "podcast", "topics", "video"],
    format: "Topic planner",
    intendedUse: "Plan weekly video or podcast content without starting from a blank page.",
    instructions:
      "Pick one audience, one question, one takeaway, and one CTA for each episode.",
    department: "Marketing Department",
    detail: {
      summary:
        "A structured content planner for turning mortgage questions into useful episodes, clips, and newsletter ideas.",
      sections: [
        {
          title: "Topic lanes",
          items: [
            "First-time buyer questions",
            "Realtor partner strategy",
            "Market education",
            "Loan process myths",
            "Credit, income, and down payment preparation",
          ],
        },
        {
          title: "Episode structure",
          items: [
            "Hook: the exact question being answered",
            "Context: why it matters",
            "Three points: simple, useful, specific",
            "CTA: consultation, webinar, guide, or partner conversation",
          ],
        },
      ],
      nextSteps: ["Copy a topic into Social Studio and create three supporting posts."],
    },
    source: "default",
    updatedAt: null,
  },
  {
    id: "realtor-social-campaign-pack",
    title: "Realtor Co-Branded Social Campaign Pack",
    description:
      "Starter copy and post structure for realtor co-branded campaigns.",
    category: "Social Campaign Packs",
    resourceType: "social_pack",
    url: null,
    embedUrl: null,
    thumbnailUrl: null,
    durationMinutes: null,
    audience: "Loan officers",
    tags: ["realtor", "co-branded", "social"],
    format: "Campaign pack",
    intendedUse: "Create a recurring partner campaign in Social Studio.",
    instructions:
      "Customize partner name, market, listing context, and CTA; keep compliance and brand review intact.",
    department: "Marketing Department",
    detail: {
      summary:
        "A campaign pack for partner-friendly mortgage education posts that can be adapted for a realtor audience.",
      includedAssets: [
        "Post themes",
        "Caption starters",
        "Image guidance",
        "CTA options",
        "Customization checklist",
      ],
      sections: [
        {
          title: "Campaign posts",
          items: [
            "Buyer preparation checklist",
            "What pre-approval tells a seller",
            "Common contract-to-close questions",
            "Open house financing reminder",
            "Partner spotlight or local market education",
          ],
        },
        {
          title: "Customization checklist",
          items: [
            "Add realtor partner name and brokerage when approved.",
            "Use compliant wording and avoid guarantees.",
            "Attach a relevant branded image or campaign visual.",
          ],
        },
      ],
      nextSteps: ["Duplicate the campaign into Social Studio and schedule a two-week sequence."],
    },
    source: "default",
    updatedAt: null,
  },
  {
    id: "newsletter-template",
    title: "Monthly Mortgage Newsletter Template",
    description:
      "Email newsletter starter for rates, buyer tips, market education, and consultation CTAs.",
    category: "Email Newsletters",
    resourceType: "email_template",
    url: null,
    embedUrl: null,
    thumbnailUrl: null,
    durationMinutes: null,
    audience: "Loan officers",
    tags: ["newsletter", "email", "education"],
    format: "Email template",
    intendedUse: "Draft a reusable Email Studio campaign.",
    instructions:
      "Copy into Email Studio, update market notes, add one clear CTA, and save as a draft before testing.",
    department: "Marketing Department",
    detail: {
      summary:
        "A reusable newsletter structure for mortgage education, buyer preparation, realtor partner value, and consultation calls to action.",
      includedAssets: [
        "Subject line options",
        "Opening section",
        "Educational topic block",
        "CTA block",
        "Compliance reminder",
      ],
      copyBlocks: [
        {
          title: "Starter subject lines",
          body:
            "This month in mortgage prep\nBuyer questions I am hearing right now\nA quick home financing tip for this month",
        },
        {
          title: "Starter newsletter body",
          body:
            "Hi {{first_name}},\n\nThis month I am helping buyers and homeowners focus on preparation, not guesswork. Here is one practical thing to know before you shop, refinance, or make a move.\n\n{{education_block}}\n\nIf you want to talk through your numbers or timeline, reply to this email and I can help you map out the next step.",
        },
      ],
      complianceNote:
        "Keep rate and payment references general unless the campaign has current, reviewed disclosures.",
      nextSteps: ["Copy the starter body into Email Studio and save it as a draft."],
    },
    source: "default",
    updatedAt: null,
  },
  {
    id: "open-house-material",
    title: "Open House Material",
    description:
      "Open house flyer and follow-up framework for buyer conversations generated from property visits.",
    category: "Open House Materials",
    resourceType: "flyer",
    url: null,
    embedUrl: null,
    thumbnailUrl: null,
    durationMinutes: null,
    audience: "Loan officers and realtor partners",
    tags: ["open house", "flyer", "follow-up"],
    format: "Flyer and follow-up outline",
    intendedUse: "Support open house lead capture and next-step education.",
    instructions:
      "Customize the event, realtor partner, buyer CTA, and follow-up timing.",
    department: "Marketing Department",
    detail: {
      summary:
        "A practical open house support kit for connecting interested buyers to financing education.",
      sections: [
        {
          title: "Included pieces",
          items: [
            "Simple financing conversation starter",
            "QR/contact CTA concept",
            "Post-event follow-up copy",
            "Realtor partner co-branding notes",
          ],
        },
      ],
      nextSteps: ["Create the flyer visual in Image Studio or Canva and save follow-up copy in Email Studio."],
    },
    source: "default",
    updatedAt: null,
  },
  {
    id: "buyer-education-handout",
    title: "Buyer Education Handout",
    description:
      "One-page handout for explaining pre-approval, documents, affordability, and next steps.",
    category: "Buyer Education",
    resourceType: "checklist",
    url: null,
    embedUrl: null,
    thumbnailUrl: null,
    durationMinutes: null,
    audience: "Buyers and loan officers",
    tags: ["buyer education", "checklist", "pre-approval"],
    format: "One-page handout",
    intendedUse: "Use after first conversations, webinars, and open houses.",
    instructions:
      "Keep language simple and route personal loan advice to a consultation.",
    department: "Marketing Department",
    detail: {
      summary:
        "A concise handout for buyers who need to understand what happens before a formal loan review.",
      sections: [
        {
          title: "Suggested sections",
          items: [
            "Documents to gather",
            "What affects buying power",
            "What a lender reviews",
            "What to avoid before applying",
            "Next step: schedule a buyer consultation",
          ],
        },
      ],
      complianceNote:
        "Use educational language and avoid implying approval before application and review.",
      nextSteps: ["Attach the handout to webinar follow-ups or buyer consultation emails."],
    },
    source: "default",
    updatedAt: null,
  },
  {
    id: "presentation-outline",
    title: "Presentation Outline",
    description:
      "General-purpose mortgage presentation structure for seminars, partner meetings, and buyer education.",
    category: "Presentation Outlines",
    resourceType: "presentation_outline",
    url: null,
    embedUrl: null,
    thumbnailUrl: null,
    durationMinutes: null,
    audience: "Loan officers",
    tags: ["presentation", "seminar", "outline"],
    format: "Presentation outline",
    intendedUse: "Plan a deck before building slides.",
    instructions:
      "Choose the audience first, then adapt the outline and CTA to that audience.",
    department: "Marketing Department",
    detail: {
      summary:
        "A reusable presentation structure so mortgage education sessions feel organized and concise.",
      steps: [
        "Define the audience and outcome.",
        "Choose three teaching points.",
        "Add one story or example per point.",
        "End with a clear next action.",
      ],
      nextSteps: ["Use this before building a webinar, buyer class, or realtor seminar deck."],
    },
    source: "default",
    updatedAt: null,
  },
  {
    id: "script-template",
    title: "Script Template",
    description:
      "Starter scripts for buyer calls, realtor outreach, seminar invitations, and follow-up messages.",
    category: "Script Templates",
    resourceType: "script",
    url: null,
    embedUrl: null,
    thumbnailUrl: null,
    durationMinutes: null,
    audience: "Loan officers",
    tags: ["script", "outreach", "follow-up"],
    format: "Script set",
    intendedUse: "Create consistent, useful outreach without sounding generic.",
    instructions:
      "Personalize the first line, keep the ask clear, and do not overstate outcomes.",
    department: "Marketing Department",
    detail: {
      summary:
        "A script framework for turning common outreach moments into clear, repeatable messages.",
      copyBlocks: [
        {
          title: "Buyer follow-up",
          body:
            "Hi {{first_name}}, I wanted to follow up on your homebuying timeline. If you are still thinking about buying, the next best step is a short review of your goals, budget comfort zone, and documents so we can map out a realistic path.",
        },
        {
          title: "Realtor seminar invite",
          body:
            "Hi {{first_name}}, I am putting together a practical training on AI and mortgage-safe marketing ideas for real estate agents. I think your team would get value from it. Would you be open to a short session?",
        },
      ],
      nextSteps: ["Copy a block and customize it before using it in email, text, or social DMs."],
    },
    source: "default",
    updatedAt: null,
  },
];

export const DEFAULT_LF_RESOURCES: TeamResourceItem[] = [
  {
    id: "lf-training-folder",
    title: "Loan Factory Training Folder",
    description:
      "Top-level Jeremy and Andre Drive folder for Loan Factory training and resource organization.",
    category: "Loan Factory Training",
    resourceType: "drive_folder",
    url: LF_TRAINING_FOLDER_URL,
    embedUrl: null,
    thumbnailUrl: null,
    durationMinutes: null,
    audience: "All team members",
    tags: ["Loan Factory", "training", "Drive"],
    format: "Drive folder",
    intendedUse: "Use the internal guide first, then open the source folder when raw files are needed.",
    instructions: "Use this folder as the source of truth while Jeremy curates individual links.",
    department: "Training Academy",
    detail: {
      summary:
        "Internal landing page for the provided Loan Factory training folder. The Drive link is preserved as the source, but the primary experience is guidance inside LegendsOS.",
      sections: [
        {
          title: "Who should use this",
          items: [
            "Loan officers looking for official training context",
            "Owners curating LF resources into LegendsOS",
            "Team members validating whether a source file belongs in Training or LF Resources",
          ],
        },
        {
          title: "What is included",
          items: [
            "Training folders and source documents",
            "AI training source material",
            "Team operating references from the Jeremy and Andre folder",
          ],
        },
        {
          title: "How to use it",
          items: [
            "Search this LF Resources page first.",
            "Open the source folder only when you need the original material.",
            "Ask Jeremy to promote high-use files into internal resource cards.",
          ],
        },
      ],
      nextSteps: ["Open the source folder in a new tab if the internal card does not include the exact file yet."],
    },
    source: "default",
    updatedAt: null,
  },
  {
    id: "lf-team-directory-doc",
    title: "Loan Factory TERA Team Directory",
    description:
      "Team directory document available from the Loan Factory resource folder.",
    category: "Loan Officer Support",
    resourceType: "document",
    url: "https://docs.google.com/document/d/1xMmyhfEi0BIzxH3GsUI0XpmJS-HH51kj/edit?usp=drivesdk&ouid=110305764628203153224&rtpof=true&sd=true",
    embedUrl: null,
    thumbnailUrl: null,
    durationMinutes: null,
    audience: "Loan officers",
    tags: ["directory", "support"],
    format: "DOCX",
    intendedUse: "Find team contacts and support references.",
    instructions: "Open in Google Docs when the latest directory is needed.",
    department: "Loan Officer Support",
    detail: {
      summary:
        "Directory reference for support contacts and team handoffs. Use it when you need the right internal person or support path.",
      sections: [
        {
          title: "When to use it",
          items: [
            "You need a department or support contact.",
            "You are unsure where to route a team question.",
            "You are onboarding and need a quick support map.",
          ],
        },
      ],
      nextSteps: ["Open the source document for the latest contact details."],
    },
    source: "default",
    updatedAt: null,
  },
  {
    id: "lo-development-docs",
    title: "LO Development Docs",
    description:
      "Loan officer development documentation folder from the training source.",
    category: "LO Development",
    resourceType: "drive_folder",
    url: "https://drive.google.com/drive/folders/1ruMCllR7FGVAUn9S38F3_sgafH8heCia",
    embedUrl: null,
    thumbnailUrl: null,
    durationMinutes: null,
    audience: "Loan officers",
    tags: ["LO development", "coaching"],
    format: "Drive folder",
    intendedUse: "Review development plans and coaching docs.",
    instructions: "Use during onboarding and post-onboarding check-ins.",
    department: "LO Development",
    detail: {
      summary:
        "Development resources for improving LO execution, sales habits, pipeline discipline, and follow-through after onboarding.",
      sections: [
        {
          title: "Best fit",
          items: [
            "Loan officer coaching",
            "Post-onboarding planning",
            "Performance and skill development",
          ],
        },
      ],
      nextSteps: ["Use during a coaching session, then document follow-up tasks in Atlas or Calendar."],
    },
    source: "default",
    updatedAt: null,
  },
  {
    id: "ai-loan-placement-helpdesk",
    title: "AI Loan Placement HelpDesk",
    description:
      "Loan placement helpdesk folder for scenario support and lender-fit research.",
    category: "Lender Escalation Resources",
    resourceType: "drive_folder",
    url: "https://drive.google.com/drive/folders/1fHy9UdzvC3wIiPBx-HYUsrexpkBRK6Ce",
    embedUrl: null,
    thumbnailUrl: null,
    durationMinutes: null,
    audience: "Loan officers and processors",
    tags: ["loan placement", "lender", "scenario"],
    format: "Drive folder",
    intendedUse: "Escalate scenarios and find loan-placement guidance.",
    instructions: "Open before escalating a complex loan-fit question.",
    department: "Lender Support",
    detail: {
      summary:
        "Scenario support for loan placement questions and lender-fit research before a complex file is escalated.",
      sections: [
        {
          title: "When to use it",
          items: [
            "A loan scenario needs lender-fit guidance.",
            "You need to gather facts before escalating.",
            "A borrower scenario has program complexity.",
          ],
        },
      ],
      nextSteps: [
        "Document the borrower scenario clearly.",
        "Open the source folder for current placement guidance.",
        "Escalate through the correct LF support path when needed.",
      ],
    },
    source: "default",
    updatedAt: null,
  },
  {
    id: "lf-ai-live-training",
    title: "LF AI Training Live Slide Deck Site",
    description:
      "AI training slide-deck site folder from the Loan Factory training knowledge source.",
    category: "AI Training Resources",
    resourceType: "drive_folder",
    url: "https://drive.google.com/drive/folders/1NZh2w3KP-Xwzm_pxNxxBPpAo8DwB2LyC",
    embedUrl: null,
    thumbnailUrl: null,
    durationMinutes: null,
    audience: "All team members",
    tags: ["AI training", "slides"],
    format: "Drive folder",
    intendedUse: "Use for AI training sessions and refreshers.",
    instructions: "Open the folder and choose the latest reviewed training deck.",
    department: "AI Training",
    detail: {
      summary:
        "AI training deck source for live sessions, refreshers, and team enablement.",
      sections: [
        {
          title: "Use this for",
          items: [
            "AI training sessions",
            "Loan officer AI refreshers",
            "Content that should become LegendsOS Training cards",
          ],
        },
      ],
      nextSteps: ["Owner: turn current deck modules into individual Training items."],
    },
    source: "default",
    updatedAt: null,
  },
  {
    id: "corporate-coaching",
    title: "Corporate Coaching",
    description:
      "Internal coaching lane for team standards, leadership messages, recurring coaching themes, and execution expectations.",
    category: "Corporate Coaching",
    resourceType: "guide",
    url: null,
    embedUrl: null,
    thumbnailUrl: null,
    durationMinutes: null,
    audience: "Loan officers and team leads",
    tags: ["coaching", "leadership", "execution"],
    format: "Internal guide",
    intendedUse: "Find coaching direction before building training or follow-up tasks.",
    instructions:
      "Add official coaching documents or videos here as Jeremy curates them.",
    department: "Corporate Coaching",
    detail: {
      summary:
        "A landing page for coaching content that helps LOs understand expectations, execution standards, and current focus areas.",
      sections: [
        {
          title: "What should live here",
          items: [
            "Sales coaching",
            "Mindset and execution standards",
            "Team leadership notes",
            "Approved coaching videos or handouts",
          ],
        },
      ],
      nextSteps: ["Owner: attach the first approved corporate coaching video or document."],
    },
    source: "default",
    updatedAt: null,
  },
  {
    id: "marketing-department",
    title: "Marketing Department",
    description:
      "Where loan officers find marketing support expectations, approved request paths, and campaign resource guidance.",
    category: "Marketing Department",
    resourceType: "guide",
    url: null,
    embedUrl: null,
    thumbnailUrl: null,
    durationMinutes: null,
    audience: "Loan officers",
    tags: ["marketing", "support", "campaigns"],
    format: "Department guide",
    intendedUse: "Understand what marketing support exists and where to start.",
    instructions:
      "Use Marketing Materials for templates; use this page for department guidance.",
    department: "Marketing Department",
    detail: {
      summary:
        "A department guide for marketing support and campaign resource routing.",
      sections: [
        {
          title: "Use this for",
          items: [
            "Knowing which marketing materials already exist",
            "Understanding what should be created in Image Studio or Social Studio",
            "Finding the next step for campaign requests",
          ],
        },
      ],
      nextSteps: ["Open Marketing Materials for templates or ask Atlas to draft a campaign plan."],
    },
    source: "default",
    updatedAt: null,
  },
  {
    id: "loan-factory-system-links",
    title: "Loan Factory System Links",
    description:
      "A clean internal index for key Loan Factory systems and where each tool fits in the team's workflow.",
    category: "Loan Factory System Links",
    resourceType: "directory",
    url: null,
    embedUrl: null,
    thumbnailUrl: null,
    durationMinutes: null,
    audience: "All team members",
    tags: ["systems", "links", "operations"],
    format: "Directory",
    intendedUse: "Find the right LF system path without hunting through notes.",
    instructions:
      "Do not invent private URLs. Add official system links as Jeremy approves them.",
    department: "Operations",
    detail: {
      summary:
        "A placeholder-ready system directory for official Loan Factory tools. Private URLs should be added only when Jeremy provides them.",
      sections: [
        {
          title: "How to use it",
          items: [
            "Search by system or workflow.",
            "Use only approved official links.",
            "Ask Jeremy to add missing private URLs rather than guessing.",
          ],
        },
      ],
      nextSteps: ["Owner: add approved LF system URLs as team-shared resources."],
    },
    source: "default",
    updatedAt: null,
  },
  {
    id: "important-forms",
    title: "Important Forms",
    description:
      "Internal landing page for official forms, intake resources, and documents that should not be buried in Drive.",
    category: "Important Forms",
    resourceType: "directory",
    url: null,
    embedUrl: null,
    thumbnailUrl: null,
    durationMinutes: null,
    audience: "Loan officers and team support",
    tags: ["forms", "documents", "operations"],
    format: "Forms index",
    intendedUse: "Find approved forms and instructions before requesting help.",
    instructions:
      "Add official form links only when provided by Jeremy or Loan Factory.",
    department: "Operations",
    detail: {
      summary:
        "A guided forms index. It is intentionally internal-first so the team understands what a form is for before opening it.",
      sections: [
        {
          title: "What each form card should include",
          items: [
            "What the form is",
            "Who should use it",
            "When it applies",
            "What information is needed before opening it",
          ],
        },
      ],
      nextSteps: ["Owner: add high-use forms as individual resource cards with source links."],
    },
    source: "default",
    updatedAt: null,
  },
  {
    id: "n8n-legendsos-setup",
    title: "n8n and LegendsOS Setup",
    description:
      "Setup guidance for the LegendsOS broker, n8n webhooks, workflow status, MCP basics, and owner-managed integrations.",
    category: "n8n and LegendsOS Setup",
    resourceType: "setup_guide",
    url: null,
    embedUrl: null,
    thumbnailUrl: null,
    durationMinutes: null,
    audience: "Owner, admins, and trained team members",
    tags: ["n8n", "LegendsOS", "setup", "MCP"],
    format: "Setup guide",
    intendedUse: "Understand setup status and next actions before changing integrations.",
    instructions:
      "Use Settings for current status. Do not change secrets in the browser.",
    department: "LegendsOS",
    detail: {
      summary:
        "Internal setup guide for the safe broker-first workflow. This keeps n8n and integration questions routed through Settings and the Setup Coach.",
      sections: [
        {
          title: "Setup path",
          items: [
            "Review Settings connection status.",
            "Use the Setup Coach for step-by-step help.",
            "Add or rotate secrets only in the hosting/provider system, never in the browser.",
            "Keep live email and social actions disabled unless owner flags and workflows are configured.",
          ],
        },
      ],
      nextSteps: ["Open Settings connection setup or the Setup Coach for the exact integration path."],
    },
    source: "default",
    updatedAt: null,
  },
  {
    id: "google-workspace-setup",
    title: "Google Workspace Setup",
    description:
      "Guidance for Gmail, Google Calendar, Google Drive, and Workspace-connected resource workflows.",
    category: "Google Workspace Setup",
    resourceType: "setup_guide",
    url: null,
    embedUrl: null,
    thumbnailUrl: null,
    durationMinutes: null,
    audience: "Owner and team members",
    tags: ["Google", "Gmail", "Calendar", "Drive"],
    format: "Setup guide",
    intendedUse: "Understand which Google connection is needed for each workflow.",
    instructions:
      "Use Settings for setup status and connect through supported OAuth paths when available.",
    department: "Google Workspace",
    detail: {
      summary:
        "A Google setup guide that separates Gmail, Calendar, Drive, and resource access so the team knows what each connection enables.",
      sections: [
        {
          title: "Connection lanes",
          items: [
            "Gmail: email drafting and safe test-send paths when supported",
            "Google Calendar: calendar planning and sync readiness",
            "Google Drive: knowledge sources, training files, and resource folders",
          ],
        },
      ],
      nextSteps: ["Open Settings to review Google setup status and available actions."],
    },
    source: "default",
    updatedAt: null,
  },
  {
    id: "post-onboarding-check-in",
    title: "Post Onboarding Check In",
    description:
      "Guided check-in lane for new team members after initial setup and early platform use.",
    category: "Post Onboarding Check In",
    resourceType: "checklist",
    url: null,
    embedUrl: null,
    thumbnailUrl: null,
    durationMinutes: null,
    audience: "Loan officers and team leads",
    tags: ["onboarding", "check-in", "LO development"],
    format: "Checklist",
    intendedUse: "Run a structured check-in after onboarding.",
    instructions:
      "Use this after the LO has logged in, opened Atlas, reviewed Training, and found LF Resources.",
    department: "LO Development",
    detail: {
      summary:
        "A structured post-onboarding check-in so new users get help after real platform usage, not only before login.",
      sections: [
        {
          title: "Check-in prompts",
          items: [
            "Can the user log in and navigate the core pages?",
            "Did they open Atlas and understand where projects/resources live?",
            "Can they find Training, Marketing Materials, and LF Resources?",
            "What recurring support question should become a training nugget?",
          ],
        },
      ],
      nextSteps: ["Owner: use impersonation preview if the user reports a role-specific issue."],
    },
    source: "default",
    updatedAt: null,
  },
  {
    id: "department-feedback",
    title: "Department Feedback",
    description:
      "A place to collect feedback themes, routing notes, and improvement requests for LF resource coverage.",
    category: "Department Feedback",
    resourceType: "feedback",
    url: null,
    embedUrl: null,
    thumbnailUrl: null,
    durationMinutes: null,
    audience: "Owner and team members",
    tags: ["feedback", "departments", "improvements"],
    format: "Feedback guide",
    intendedUse: "Capture what resources are missing or unclear.",
    instructions:
      "Use this when the team repeatedly cannot find the same answer or file.",
    department: "Operations",
    detail: {
      summary:
        "A lightweight feedback guide for improving the LF resource directory over time.",
      sections: [
        {
          title: "What to capture",
          items: [
            "The missing resource or unclear page",
            "Who needed it",
            "When it came up",
            "What the next best internal page should be",
          ],
        },
      ],
      nextSteps: ["Owner: turn repeated feedback into a new LF Resource or Training card."],
    },
    source: "default",
    updatedAt: null,
  },
];

// =====================================================================
// SHARED RESOURCE INTAKE — review items
// =====================================================================
//
// A "review item" is a piece of pasted/uploaded content that an AI step
// turns into a recommended shared-resource draft. It is persisted in the
// EXISTING `shared_resources` table (no new migration) using:
//   - resource_type = "review_item" (status marker, not a team category)
//   - is_active = false (kept OUT of the team-facing read list until published)
//   - payload jsonb = the full review-item record below
//
// The review_status field is the source of truth for the lifecycle:
//   - "pending_ai_review": saved, AI not configured OR AI call failed.
//     The raw content is preserved so the owner can re-run review later.
//   - "ai_reviewed": AI produced recommendations; owner can edit + publish.
//   - "published": owner promoted it to a live shared resource (is_active=true,
//     resource_type set to the recommended category type).
//
// We NEVER set "ai_reviewed" unless the AI actually returned content. A failed
// or unconfigured AI step stays "pending_ai_review" — never a fake "completed".

export const SHARED_REVIEW_RESOURCE_TYPE = "review_item";

export type SharedReviewStatus = "pending_ai_review" | "ai_reviewed" | "published";

export type SharedReviewInputKind =
  | "plain_text"
  | "markdown"
  | "transcript"
  | "pasted"
  | "youtube_transcript"
  | "uploaded_file";

export type SharedReviewShareStatus = "team" | "internal_only" | "needs_owner_review";

/** AI-recommended fields. Every field is optional — a partial AI response is
 *  still useful and must not crash the UI. */
export interface SharedReviewRecommendation {
  title?: string;
  description?: string;
  category?: string;
  audience?: string;
  body?: string;
  teamSummary?: string;
  sanitizedVersion?: string;
  legendsVoiceRewrite?: string;
  complianceNotes?: string;
  shareStatus?: SharedReviewShareStatus;
}

export interface SharedReviewFileMeta {
  name: string;
  /** MIME type as reported by the browser. */
  type: string;
  size: number;
  /** Always true for binary uploads — extraction is honestly deferred. */
  pendingTextExtraction: boolean;
}

export interface SharedReviewItem {
  id: string;
  title: string;
  reviewStatus: SharedReviewStatus;
  inputKind: SharedReviewInputKind;
  /** Raw pasted/typed text. Empty for binary-only uploads. */
  sourceText: string;
  /** Present only for binary uploads (PDF/DOCX) that we did not parse. */
  file: SharedReviewFileMeta | null;
  recommendation: SharedReviewRecommendation | null;
  /** Provider/model that produced the recommendation, when AI ran. */
  aiProvider: string | null;
  aiModel: string | null;
  /** Honest note about why AI did not run, when applicable. */
  aiNote: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export const SHARED_REVIEW_INPUT_KINDS: {
  value: SharedReviewInputKind;
  label: string;
  textBased: boolean;
}[] = [
  { value: "pasted", label: "Pasted content", textBased: true },
  { value: "plain_text", label: "Plain text", textBased: true },
  { value: "markdown", label: "Markdown", textBased: true },
  { value: "transcript", label: "Transcript", textBased: true },
  { value: "youtube_transcript", label: "YouTube transcript (text)", textBased: true },
  { value: "uploaded_file", label: "Uploaded file (PDF / DOCX)", textBased: false },
];

const REVIEW_STATUS_LABELS: Record<SharedReviewStatus, string> = {
  pending_ai_review: "Pending AI review",
  ai_reviewed: "AI reviewed",
  published: "Published to team",
};

export function reviewStatusLabel(status: SharedReviewStatus): string {
  return REVIEW_STATUS_LABELS[status] ?? status;
}

export function reviewStatusTone(status: SharedReviewStatus): "ok" | "info" | "warn" {
  if (status === "published") return "ok";
  if (status === "ai_reviewed") return "info";
  return "warn";
}

function recommendationFromPayload(value: unknown): SharedReviewRecommendation | null {
  if (!value || typeof value !== "object") return null;
  const s = value as Record<string, unknown>;
  const shareRaw = stringValue(s.share_status ?? s.shareStatus);
  const shareStatus: SharedReviewShareStatus | undefined =
    shareRaw === "team" || shareRaw === "internal_only" || shareRaw === "needs_owner_review"
      ? shareRaw
      : undefined;
  const rec: SharedReviewRecommendation = {
    title: stringValue(s.title) ?? undefined,
    description: stringValue(s.description) ?? undefined,
    category: stringValue(s.category) ?? undefined,
    audience: stringValue(s.audience) ?? undefined,
    body: stringValue(s.body) ?? undefined,
    teamSummary: stringValue(s.team_summary ?? s.teamSummary) ?? undefined,
    sanitizedVersion: stringValue(s.sanitized_version ?? s.sanitizedVersion) ?? undefined,
    legendsVoiceRewrite:
      stringValue(s.legends_voice_rewrite ?? s.legendsVoiceRewrite) ?? undefined,
    complianceNotes: stringValue(s.compliance_notes ?? s.complianceNotes) ?? undefined,
    shareStatus,
  };
  return Object.values(rec).some(Boolean) ? rec : null;
}

/** Map an existing `shared_resources` row (resource_type = review_item) into a
 *  typed SharedReviewItem. Tolerant of partial/missing payload fields. */
export function reviewItemFromShared(row: SharedResource): SharedReviewItem {
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  const statusRaw = stringValue(payload.review_status ?? payload.reviewStatus);
  const reviewStatus: SharedReviewStatus =
    statusRaw === "ai_reviewed" || statusRaw === "published"
      ? statusRaw
      : "pending_ai_review";
  const kindRaw = stringValue(payload.input_kind ?? payload.inputKind);
  const inputKind = (SHARED_REVIEW_INPUT_KINDS.find((k) => k.value === kindRaw)?.value ??
    "pasted") as SharedReviewInputKind;

  const fileRaw = payload.file;
  let file: SharedReviewFileMeta | null = null;
  if (fileRaw && typeof fileRaw === "object") {
    const f = fileRaw as Record<string, unknown>;
    const name = stringValue(f.name);
    if (name) {
      file = {
        name,
        type: stringValue(f.type) ?? "application/octet-stream",
        size: numberValue(f.size) ?? 0,
        pendingTextExtraction: true,
      };
    }
  }

  return {
    id: row.id,
    title: row.title,
    reviewStatus,
    inputKind,
    sourceText: stringValue(payload.source_text ?? payload.sourceText) ?? "",
    file,
    recommendation: recommendationFromPayload(payload.recommendation),
    aiProvider: stringValue(payload.ai_provider ?? payload.aiProvider),
    aiModel: stringValue(payload.ai_model ?? payload.aiModel),
    aiNote: stringValue(payload.ai_note ?? payload.aiNote),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function defaultResourcesForMode(mode: TeamResourceMode): TeamResourceItem[] {
  if (mode === "training") return DEFAULT_TRAINING_ITEMS;
  if (mode === "marketing") return DEFAULT_MARKETING_MATERIALS;
  return DEFAULT_LF_RESOURCES;
}

export function routeForResource(mode: TeamResourceMode, id: string): string {
  if (mode === "training") return `/training/${id}`;
  if (mode === "marketing") return `/marketing-materials/${id}`;
  return `/lf-resources/${id}`;
}

export function findTeamResource(
  mode: TeamResourceMode,
  id: string,
  sharedItems: TeamResourceItem[] = []
): TeamResourceItem | null {
  return [...sharedItems, ...defaultResourcesForMode(mode)].find((item) => item.id === id) ?? null;
}

export function relatedResourcesFor(
  mode: TeamResourceMode,
  item: TeamResourceItem,
  sharedItems: TeamResourceItem[] = []
): TeamResourceItem[] {
  const allItems = [...sharedItems, ...defaultResourcesForMode(mode)];
  const relatedIds = new Set(item.detail?.relatedIds ?? []);
  const explicit = allItems.filter((candidate) => relatedIds.has(candidate.id));
  const byCategory = allItems
    .filter((candidate) => candidate.id !== item.id && candidate.category === item.category)
    .filter((candidate) => !relatedIds.has(candidate.id));
  return [...explicit, ...byCategory].slice(0, 4);
}

import type { SharedResource } from "@/types/database";

export const LF_TRAINING_FOLDER_URL =
  "https://drive.google.com/drive/folders/164oRV4Vn1XRh6UTySL52USyXDugfQp6a?usp=sharing";

export const TRAINING_RESOURCE_TYPE = "training_item";
export const MARKETING_RESOURCE_TYPE = "marketing_material";
export const LF_RESOURCE_TYPE = "lf_resource";

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

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function resourceFromShared(row: SharedResource): TeamResourceItem {
  const payload = row.payload ?? {};
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
    source: "default",
    updatedAt: null,
  },
  {
    id: "social-campaign-pack",
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
    intendedUse: "Open the primary source folder.",
    instructions: "Use this folder as the source of truth while Jeremy curates individual links.",
    department: "Training Academy",
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
    source: "default",
    updatedAt: null,
  },
];

// Vibe Coding workflow catalog.
//
// Each workflow is a friendly "card" on /vibe-coding. Selecting it opens a
// detail panel with per-card inputs, a live-composed prompt, Copy / Send to
// Atlas, and a Jeremy AI Review. This is NOT a separate AI system — it composes
// prompts that the team can run through Atlas (or copy elsewhere) and offers an
// AI style review of the composed prompt.
//
// `kind` MUST match the VibeKind enum accepted by /api/vibe/review/route.ts.

export type VibeKind =
  | "realtor_landing"
  | "blog_post"
  | "simple_website"
  | "content_page"
  | "marketing_idea";

export interface VibeField {
  /** Stable key used in the values map and prompt template. */
  id: string;
  label: string;
  placeholder: string;
  /** Single-line input vs multi-line textarea. */
  type: "text" | "textarea";
  /** Optional helper hint under the field. */
  hint?: string;
  /** Whether the prompt composer treats this as required for a "complete" prompt. */
  required?: boolean;
}

export interface VibeWorkflow {
  kind: VibeKind;
  /** lucide-react icon name resolved in the client component. */
  icon:
    | "Home"
    | "PenLine"
    | "Globe"
    | "FileText"
    | "Lightbulb";
  title: string;
  blurb: string;
  fields: VibeField[];
  /**
   * Compose the final prompt from the field values. Empty fields are skipped so
   * the prompt stays clean as the user types. Always returns a non-empty string
   * (the intro line) so Copy / Send are honest even before fields are filled.
   */
  compose: (values: Record<string, string>) => string;
}

function line(label: string, value: string): string {
  const v = (value ?? "").trim();
  return v ? `- ${label}: ${v}` : "";
}

function block(...lines: string[]): string {
  return lines.filter(Boolean).join("\n");
}

export const VIBE_WORKFLOWS: VibeWorkflow[] = [
  {
    kind: "realtor_landing",
    icon: "Home",
    title: "Realtor landing page",
    blurb: "A co-branded landing page to pitch or partner with a real estate agent.",
    fields: [
      { id: "realtor", label: "Realtor / agent name", placeholder: "e.g. Dana Ruiz, Keller Williams", type: "text", required: true },
      { id: "area", label: "Market / area", placeholder: "e.g. North Phoenix, AZ", type: "text", required: true },
      { id: "audience", label: "Target buyers", placeholder: "e.g. first-time buyers, move-up families", type: "text" },
      { id: "offer", label: "Headline offer / hook", placeholder: "e.g. fast pre-approvals, local lender + agent team", type: "textarea" },
    ],
    compose: (v) =>
      block(
        "Build a clean, conversion-focused realtor co-branded landing page for a mortgage loan officer.",
        "",
        "Details:",
        line("Realtor / agent", v.realtor),
        line("Market / area", v.area),
        line("Target buyers", v.audience),
        line("Headline offer / hook", v.offer),
        "",
        "Requirements:",
        "- Hero with a clear headline, subhead, and a single primary call-to-action.",
        "- Short sections: why work with this LO + agent team, the buying steps, social proof placeholder, and a contact form.",
        "- Friendly, trustworthy tone. No guaranteed-rate or guaranteed-approval language.",
        "- Include placeholders for NMLS + Equal Housing disclosure in the footer.",
      ),
  },
  {
    kind: "blog_post",
    icon: "PenLine",
    title: "Blog post",
    blurb: "An educational blog post that builds trust and ranks for local search.",
    fields: [
      { id: "topic", label: "Topic", placeholder: "e.g. How rate buydowns work", type: "text", required: true },
      { id: "audience", label: "Who it's for", placeholder: "e.g. first-time buyers", type: "text" },
      { id: "keywords", label: "Keywords to target", placeholder: "e.g. 2-1 buydown, lower payment", type: "text" },
      { id: "angle", label: "Angle / key takeaway", placeholder: "e.g. when a buydown beats a price cut", type: "textarea" },
    ],
    compose: (v) =>
      block(
        "Write an educational, trustworthy mortgage blog post for a loan officer's website.",
        "",
        "Details:",
        line("Topic", v.topic),
        line("Audience", v.audience),
        line("Target keywords", v.keywords),
        line("Angle / key takeaway", v.angle),
        "",
        "Requirements:",
        "- 600-900 words, scannable with H2/H3 headers and short paragraphs.",
        "- Plain-English, helpful, not salesy. Explain terms the first time they appear.",
        "- End with a soft call-to-action to reach out for a personalized quote.",
        "- No guaranteed rates/approvals; note that examples are illustrative.",
        "- Leave a placeholder for NMLS + Equal Housing disclosure.",
      ),
  },
  {
    kind: "simple_website",
    icon: "Globe",
    title: "Simple website",
    blurb: "A small multi-section personal site for a loan officer.",
    fields: [
      { id: "name", label: "Loan officer name", placeholder: "e.g. Jeremy McDonald", type: "text", required: true },
      { id: "tagline", label: "Tagline", placeholder: "e.g. Straight-talk mortgages for AZ families", type: "text" },
      { id: "services", label: "Services to feature", placeholder: "e.g. purchase, refi, VA, FHA", type: "text" },
      { id: "vibe", label: "Look & feel", placeholder: "e.g. modern, warm, premium, minimal", type: "textarea" },
    ],
    compose: (v) =>
      block(
        "Build a simple, professional personal website for a mortgage loan officer.",
        "",
        "Details:",
        line("Loan officer", v.name),
        line("Tagline", v.tagline),
        line("Services to feature", v.services),
        line("Look & feel", v.vibe),
        "",
        "Requirements:",
        "- Sections: hero, about, services, simple process, testimonials placeholder, contact.",
        "- Mobile-first, fast, accessible. One clear primary call-to-action.",
        "- Compliant tone — no guaranteed rates/approvals.",
        "- Footer placeholders for NMLS number and Equal Housing Lender disclosure.",
      ),
  },
  {
    kind: "content_page",
    icon: "FileText",
    title: "Content page",
    blurb: "A focused page explaining one program, offer, or topic.",
    fields: [
      { id: "subject", label: "Page subject", placeholder: "e.g. FHA loans explained", type: "text", required: true },
      { id: "goal", label: "Goal of the page", placeholder: "e.g. capture leads, educate", type: "text" },
      { id: "points", label: "Key points to cover", placeholder: "e.g. down payment, credit, MIP", type: "textarea" },
    ],
    compose: (v) =>
      block(
        "Write a focused web content page for a mortgage loan officer's site.",
        "",
        "Details:",
        line("Subject", v.subject),
        line("Goal", v.goal),
        line("Key points", v.points),
        "",
        "Requirements:",
        "- Clear intro, well-structured body with headers, and a closing call-to-action.",
        "- Educational and reassuring; define jargon in plain English.",
        "- No guaranteed rates/approvals; mark any numbers as illustrative examples.",
        "- Placeholder for NMLS + Equal Housing disclosure.",
      ),
  },
  {
    kind: "marketing_idea",
    icon: "Lightbulb",
    title: "Marketing idea",
    blurb: "Brainstorm a campaign, post series, or promotion concept.",
    fields: [
      { id: "objective", label: "Objective", placeholder: "e.g. more refi leads from past clients", type: "text", required: true },
      { id: "channel", label: "Channel(s)", placeholder: "e.g. email + Instagram", type: "text" },
      { id: "audience", label: "Audience", placeholder: "e.g. past clients, realtors", type: "text" },
      { id: "constraints", label: "Constraints / notes", placeholder: "e.g. budget-light, 2 weeks", type: "textarea" },
    ],
    compose: (v) =>
      block(
        "Brainstorm a practical mortgage marketing campaign for a loan officer.",
        "",
        "Details:",
        line("Objective", v.objective),
        line("Channel(s)", v.channel),
        line("Audience", v.audience),
        line("Constraints / notes", v.constraints),
        "",
        "Requirements:",
        "- Give 3-5 concrete campaign ideas, each with a hook, format, and first step.",
        "- Recommend one to start with and why.",
        "- Keep claims compliant — no guaranteed rates/approvals.",
      ),
  },
];

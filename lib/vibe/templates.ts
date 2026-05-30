export type VibePromptTemplate = {
  id: string;
  title: string;
  description: string;
  useCase: string;
  prompt: string;
};

export const VIBE_PROMPT_TEMPLATES: VibePromptTemplate[] = [
  {
    id: "realtor-landing-page",
    title: "Realtor Landing Page",
    description:
      "A clean, single-page site to co-market a listing or partner agent.",
    useCase: "Co-branded landing pages for a Realtor partner or open house.",
    prompt: `Build a simple, mobile-friendly one-page landing page to co-market with a real estate agent.

Tone: warm, professional, local. No engineering jargon.

Include these sections in order:
1. A hero with a friendly headline, a short subheadline, and one clear call-to-action button ("Get Pre-Approved" or "Ask a Question").
2. A short "Why work with us" block with 3 benefit bullets (fast pre-approvals, local expertise, clear communication).
3. A simple lead form with Name, Email, Phone, and an optional message.
4. A footer with the loan officer's name, title, NMLS ID, company name, and the Equal Housing Opportunity statement.

Compliance rules you MUST follow:
- Do NOT promise or guarantee any interest rate, approval, or closing time.
- Always include my NMLS ID placeholder: [NMLS #XXXXXXX].
- Always include "Equal Housing Lender / Equal Housing Opportunity."
- Avoid words like "guaranteed," "lowest rate," or "best rate."

Use placeholder text where I need to fill in details. Keep the design clean and trustworthy.`,
  },
  {
    id: "blog-post",
    title: "Blog Post",
    description:
      "An educational, SEO-friendly article that builds trust with buyers.",
    useCase: "Homebuyer education posts for your website or newsletter.",
    prompt: `Write a friendly, educational blog post for first-time homebuyers.

Topic: [INSERT TOPIC, e.g. "5 things to know before you get pre-approved"].

Audience: everyday homebuyers, not finance experts. Keep it simple and encouraging.

Structure:
1. A short, relatable intro (2-3 sentences).
2. 4-6 clear sections with helpful subheadings.
3. A short, warm closing that invites the reader to reach out with questions.

Compliance rules you MUST follow:
- Educational tone only. Do NOT give individualized financial advice.
- Do NOT quote, promise, or guarantee specific rates, payments, or approval.
- Use "may," "could," and "depending on your situation" rather than absolute claims.
- End with: "Contact [Your Name], [Title], NMLS #XXXXXXX. Equal Housing Opportunity."

Keep paragraphs short. Use a confident, helpful voice.`,
  },
  {
    id: "simple-website",
    title: "Simple Website",
    description:
      "A small multi-section personal site to introduce you and your services.",
    useCase: "Your personal loan officer profile and contact site.",
    prompt: `Build a simple, modern personal website for a mortgage loan officer.

Keep it to one page with clear anchored sections. Mobile-friendly and clean.

Sections:
1. Hero: my name, title, a one-line value statement, and a "Start your application" button.
2. About: a short, warm bio paragraph (use placeholder text).
3. Services: a 3-card grid (Purchase, Refinance, First-Time Buyer guidance).
4. How it works: 3 simple numbered steps.
5. Contact: my name, phone, email, NMLS ID, company, and a short message form.

Compliance rules you MUST follow:
- No rate quotes, no approval guarantees, no "lowest/best rate" language.
- Include NMLS ID placeholder [NMLS #XXXXXXX] in the footer.
- Include "Equal Housing Lender" in the footer.

Use placeholders for anything specific. Prioritize trust and clarity over flashy design.`,
  },
  {
    id: "content-page",
    title: "Content Page",
    description:
      "A focused resource or FAQ page that answers common buyer questions.",
    useCase: "A reusable FAQ or 'What to expect' resource page.",
    prompt: `Create a clean, easy-to-read content page that answers common homebuyer questions.

Page title: [INSERT, e.g. "What to Expect During the Loan Process"].

Format:
1. A short intro paragraph that reassures the reader.
2. 6-8 question-and-answer pairs written in plain language.
3. A friendly closing with a call to reach out.

Compliance rules you MUST follow:
- General information only, not personalized advice.
- Never state or imply guaranteed rates, payments, approvals, or timelines.
- Use soft language: "typically," "often," "in many cases."
- Include a footer line: "[Your Name], [Title], NMLS #XXXXXXX. Equal Housing Opportunity."

Keep it skimmable with clear headings and short answers.`,
  },
  {
    id: "marketing-idea",
    title: "Marketing Idea",
    description:
      "Brainstorm compliant campaign concepts, hooks, and post ideas.",
    useCase: "Quick idea generation for social posts and outreach.",
    prompt: `Act as a friendly marketing brainstorming partner for a mortgage loan officer.

Give me 8 compliant marketing ideas for [INSERT GOAL, e.g. "reaching first-time homebuyers this spring"].

For each idea include:
- A one-line concept.
- The channel (social post, email, short video, flyer).
- A sample headline or hook.

Compliance rules you MUST follow:
- No rate promises, no "guaranteed approval," no "lowest/best rate" claims.
- Keep everything educational, helpful, and trust-building.
- Remind me to add my NMLS ID and Equal Housing Opportunity where the asset is published.

Keep the tone upbeat and practical. These are ideas I can act on quickly.`,
  },
];

// =====================================================================
// BUILD CARDS — clickable detail data
// =====================================================================
// Each card opens a detail panel with: what it creates, the input fields
// the user fills in, and a prompt template whose {placeholders} get merged
// with those inputs. `iconKey` maps to a lucide icon in the hub component
// (kept as a string here so this module stays framework-free).

export type VibeBuildInput = {
  key: string;
  label: string;
  placeholder: string;
};

export type VibeBuildCard = {
  id: string;
  iconKey: "home" | "fileText" | "globe" | "bookOpen" | "lightbulb";
  title: string;
  description: string;
  whatItCreates: string;
  inputs: VibeBuildInput[];
  /** Prompt template with {key} placeholders matching the input keys. */
  promptTemplate: string;
};

export const VIBE_BUILD_CARDS: VibeBuildCard[] = [
  {
    id: "realtor-landing-page",
    iconKey: "home",
    title: "Realtor landing pages",
    description:
      "Co-branded one-pagers to partner with agents and capture leads.",
    whatItCreates:
      "A clean, mobile-friendly one-page co-marketing landing page (hero, benefits, lead form, compliant footer) you can hand to an AI builder or paste into Atlas.",
    inputs: [
      {
        key: "officerName",
        label: "Your name",
        placeholder: "e.g. Jeremy McDonald",
      },
      {
        key: "nmls",
        label: "NMLS ID",
        placeholder: "e.g. 123456",
      },
      {
        key: "agentName",
        label: "Partner agent name",
        placeholder: "e.g. Sarah Lee, Acme Realty",
      },
      {
        key: "cta",
        label: "Main call-to-action",
        placeholder: "e.g. Get Pre-Approved",
      },
    ],
    promptTemplate: `Build a simple, mobile-friendly one-page co-marketing landing page for a mortgage loan officer partnering with a real estate agent.

Loan officer: {officerName} (NMLS #{nmls})
Partner agent: {agentName}

Tone: warm, professional, local. No engineering jargon.

Include these sections in order:
1. A hero with a friendly headline, a short subheadline, and one clear call-to-action button labeled "{cta}".
2. A short "Why work with us" block with 3 benefit bullets (fast pre-approvals, local expertise, clear communication).
3. A simple lead form with Name, Email, Phone, and an optional message.
4. A footer with {officerName}, title, NMLS #{nmls}, company name, the partner agent's name, and the Equal Housing Opportunity statement.

Compliance rules you MUST follow:
- Do NOT promise or guarantee any interest rate, approval, or closing time.
- Always include NMLS #{nmls}.
- Always include "Equal Housing Lender / Equal Housing Opportunity."
- Avoid words like "guaranteed," "lowest rate," or "best rate."

Use placeholder text where details are missing. Keep the design clean and trustworthy.`,
  },
  {
    id: "blog-post",
    iconKey: "fileText",
    title: "Blog posts",
    description: "Educational articles that build trust with homebuyers.",
    whatItCreates:
      "A friendly, SEO-aware educational blog post for homebuyers with an intro, clear sections, and a compliant sign-off.",
    inputs: [
      {
        key: "topic",
        label: "Topic",
        placeholder: "e.g. 5 things to know before getting pre-approved",
      },
      {
        key: "audience",
        label: "Audience",
        placeholder: "e.g. first-time homebuyers",
      },
      {
        key: "officerName",
        label: "Your name",
        placeholder: "e.g. Jeremy McDonald",
      },
      {
        key: "nmls",
        label: "NMLS ID",
        placeholder: "e.g. 123456",
      },
    ],
    promptTemplate: `Write a friendly, educational blog post.

Topic: {topic}
Audience: {audience} (not finance experts — keep it simple and encouraging).

Structure:
1. A short, relatable intro (2-3 sentences).
2. 4-6 clear sections with helpful subheadings.
3. A short, warm closing that invites the reader to reach out with questions.

Compliance rules you MUST follow:
- Educational tone only. Do NOT give individualized financial advice.
- Do NOT quote, promise, or guarantee specific rates, payments, or approval.
- Use "may," "could," and "depending on your situation" rather than absolute claims.
- End with: "Contact {officerName}, Loan Officer, NMLS #{nmls}. Equal Housing Opportunity."

Keep paragraphs short. Use a confident, helpful voice.`,
  },
  {
    id: "simple-website",
    iconKey: "globe",
    title: "Simple websites",
    description: "A clean personal site to introduce you and your services.",
    whatItCreates:
      "A modern one-page personal site for a loan officer (hero, about, services grid, how-it-works, contact form) with a compliant footer.",
    inputs: [
      {
        key: "officerName",
        label: "Your name",
        placeholder: "e.g. Jeremy McDonald",
      },
      {
        key: "valueLine",
        label: "One-line value statement",
        placeholder: "e.g. Clear, local guidance from pre-approval to keys",
      },
      {
        key: "nmls",
        label: "NMLS ID",
        placeholder: "e.g. 123456",
      },
      {
        key: "company",
        label: "Company name",
        placeholder: "e.g. The Legends Mortgage Team",
      },
    ],
    promptTemplate: `Build a simple, modern one-page personal website for a mortgage loan officer.

Loan officer: {officerName}, {company} (NMLS #{nmls})
Mobile-friendly and clean, with clear anchored sections.

Sections:
1. Hero: "{officerName}", title, the value statement "{valueLine}", and a "Start your application" button.
2. About: a short, warm bio paragraph (use placeholder text).
3. Services: a 3-card grid (Purchase, Refinance, First-Time Buyer guidance).
4. How it works: 3 simple numbered steps.
5. Contact: name, phone, email, NMLS #{nmls}, company, and a short message form.

Compliance rules you MUST follow:
- No rate quotes, no approval guarantees, no "lowest/best rate" language.
- Include NMLS #{nmls} in the footer.
- Include "Equal Housing Lender" in the footer.

Use placeholders for anything specific. Prioritize trust and clarity over flashy design.`,
  },
  {
    id: "content-page",
    iconKey: "bookOpen",
    title: "Content pages",
    description: "FAQ and 'what to expect' resources you can reuse.",
    whatItCreates:
      "A focused, skimmable FAQ / 'what to expect' resource page with plain-language Q&A pairs and a compliant footer.",
    inputs: [
      {
        key: "pageTitle",
        label: "Page title",
        placeholder: "e.g. What to Expect During the Loan Process",
      },
      {
        key: "officerName",
        label: "Your name",
        placeholder: "e.g. Jeremy McDonald",
      },
      {
        key: "nmls",
        label: "NMLS ID",
        placeholder: "e.g. 123456",
      },
    ],
    promptTemplate: `Create a clean, easy-to-read content page that answers common homebuyer questions.

Page title: {pageTitle}

Format:
1. A short intro paragraph that reassures the reader.
2. 6-8 question-and-answer pairs written in plain language.
3. A friendly closing with a call to reach out.

Compliance rules you MUST follow:
- General information only, not personalized advice.
- Never state or imply guaranteed rates, payments, approvals, or timelines.
- Use soft language: "typically," "often," "in many cases."
- Include a footer line: "{officerName}, Loan Officer, NMLS #{nmls}. Equal Housing Opportunity."

Keep it skimmable with clear headings and short answers.`,
  },
  {
    id: "marketing-idea",
    iconKey: "lightbulb",
    title: "Marketing ideas",
    description: "Quick, compliant campaign concepts and post hooks.",
    whatItCreates:
      "A list of compliant marketing ideas — each with a concept, a channel, and a sample hook — that you can act on quickly.",
    inputs: [
      {
        key: "goal",
        label: "Goal",
        placeholder: "e.g. reaching first-time buyers this spring",
      },
      {
        key: "count",
        label: "How many ideas",
        placeholder: "e.g. 8",
      },
    ],
    promptTemplate: `Act as a friendly marketing brainstorming partner for a mortgage loan officer.

Give me {count} compliant marketing ideas for: {goal}.

For each idea include:
- A one-line concept.
- The channel (social post, email, short video, flyer).
- A sample headline or hook.

Compliance rules you MUST follow:
- No rate promises, no "guaranteed approval," no "lowest/best rate" claims.
- Keep everything educational, helpful, and trust-building.
- Remind me to add my NMLS ID and Equal Housing Opportunity where the asset is published.

Keep the tone upbeat and practical. These are ideas I can act on quickly.`,
  },
];

/**
 * Merge user-supplied input values into a prompt template, replacing every
 * {key} token. Empty values fall back to a readable "[label]" placeholder so
 * the prompt is never left with a raw {token} and the user can see what's
 * still missing.
 */
export function fillBuildPrompt(
  card: VibeBuildCard,
  values: Record<string, string>,
): string {
  return card.inputs.reduce((prompt, input) => {
    const raw = (values[input.key] ?? "").trim();
    const replacement = raw.length > 0 ? raw : `[${input.label}]`;
    return prompt.split(`{${input.key}}`).join(replacement);
  }, card.promptTemplate);
}

export type ComplianceSafeCopy = {
  approved: string[];
  avoid: string[];
  note: string;
};

export const COMPLIANCE_SAFE_COPY: ComplianceSafeCopy = {
  approved: [
    "Let's explore the options that may fit your situation.",
    "Pre-approval can help you understand your buying power.",
    "I'll walk you through each step and answer your questions.",
    "Rates and terms depend on your individual profile.",
    "Equal Housing Lender / Equal Housing Opportunity.",
    "[Your Name], [Title], NMLS #XXXXXXX.",
    "Reach out for a personalized conversation about your goals.",
  ],
  avoid: [
    "Guaranteed approval or guaranteed rate.",
    "We have the lowest rates / the best rates in town.",
    "You will save $X every month (specific promised savings).",
    "Approved in 24 hours — guaranteed close date claims.",
    "No-risk / 100% / always language about loan outcomes.",
    "Omitting NMLS ID on any published marketing asset.",
    "Omitting the Equal Housing Opportunity statement.",
  ],
  note: "When in doubt, soften the language and let Jeremy review it. Always include your NMLS ID and the Equal Housing Opportunity statement on anything you publish. These guidelines are a starting point, not legal advice.",
};

export type ReviewWorkflowStep = {
  step: number;
  title: string;
  detail: string;
};

export const REVIEW_WORKFLOW_STEPS: ReviewWorkflowStep[] = [
  {
    step: 1,
    title: "Draft with AI",
    detail:
      "Pick a prompt template above, fill in your details, and let the AI generate a first draft. Don't worry about perfection — it's a starting point.",
  },
  {
    step: 2,
    title: "Self-check compliance",
    detail:
      "Compare your draft against the compliance-safe copy. Remove any rate promises or guarantees, and confirm your NMLS ID and Equal Housing statement are present.",
  },
  {
    step: 3,
    title: "Submit to Jeremy",
    detail:
      "Send your draft to Jeremy for a quick review. Include the asset type and where you plan to publish it so he has the full picture.",
  },
  {
    step: 4,
    title: "Publish after approval",
    detail:
      "Once Jeremy approves, you're clear to publish. Save the approved version so you can reuse the same safe structure next time.",
  },
];

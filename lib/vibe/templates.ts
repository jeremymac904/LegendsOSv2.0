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

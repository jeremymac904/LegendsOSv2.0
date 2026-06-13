// Marketing setup training — ported from Jeremy's Elite Sales & Marketing
// source material (401/501 marketing tracks), rebranded to Legends voice.
// The source guide PDFs are not hosted in LegendsOS, so cards render the full
// training content inline instead of linking to files that do not exist here.
// "The broker portal" refers to the brokerage software the team uses day to
// day — these are tool instructions, not program branding.

export interface MarketingAiPrompt {
  title: string;
  useCase: string;
  promptStarter: string;
}

export interface MarketingCard {
  id: string;
  title: string;
  category: string;
  /** Which Elite Sales & Marketing level this supports. */
  level: "401" | "501";
  estimatedTime: string;
  audience: string;
  description: string;
  topics: string[];
  nextAction: string;
  aiPrompt: MarketingAiPrompt;
  successChecklist: string[];
  commonMistakes: string[];
  complianceCaution?: string;
}

export const marketingCards: MarketingCard[] = [
  {
    id: "facebook-ads-setup",
    title: "Facebook Ads Setup",
    category: "Paid Ads Setup",
    level: "401",
    estimatedTime: "20-30 minutes",
    audience:
      "Legends loan officers ready to connect a Facebook Business Page and launch a first ad.",
    description:
      "Connect a Facebook Business Page to the Facebook Ads tool in the broker portal, choose an ad template, set a starter budget and audience, and confirm leads flow into the pipeline.",
    topics: [
      "Confirm the Facebook Business Page requirement",
      "Connect Facebook inside the broker portal",
      "Grant Page permissions",
      "Select ad account and Default Loan Officer",
      "Launch a starter ad and verify pipeline leads",
    ],
    nextAction:
      "Confirm you have a Facebook Business Page with full admin access before connecting anything.",
    aiPrompt: {
      title: "Facebook Ads copy and audience planning",
      useCase:
        "Use AI to draft compliant ad copy options, compare audiences, and create a follow-up plan before spending budget.",
      promptStarter:
        "Draft three Facebook lead ad concepts for [market/persona]. No rates, payments, guarantees, or approval claims. Include audience notes, CTA, and first follow-up text.",
    },
    successChecklist: [
      "Facebook Business Page exists.",
      "Connecting account has full admin access.",
      "Facebook Ads config is connected in the broker portal.",
      "Ad account and Default Loan Officer are selected.",
      "Starter ad appears in the dashboard.",
      "Lead source can be checked in the pipeline.",
    ],
    commonMistakes: [
      "Connecting a personal profile without a Business Page.",
      "Using an account without full Page admin access.",
      "Skipping the Default Loan Officer selection.",
      "Increasing budget before lead routing is confirmed.",
      "Closing the browser before ad submission confirms.",
    ],
  },
  {
    id: "google-ads-ga4-setup",
    title: "Google Ads and GA4 Setup",
    category: "Tracking & Paid Search Setup",
    level: "401",
    estimatedTime: "30-45 minutes",
    audience:
      "Legends loan officers preparing to track website traffic or run Google Ads.",
    description:
      "Create GA4, create Google Ads in Expert Mode, link Ads to Analytics, and install the Google tag in the broker portal's Website Settings custom scripts.",
    topics: [
      "Create a GA4 property and web stream",
      "Create Google Ads in Expert Mode",
      "Link Ads and Analytics",
      "Install the Google tag",
      "Verify GA4 Realtime activity",
    ],
    nextAction:
      "Use a business Google account and create GA4 before installing the tag.",
    aiPrompt: {
      title: "Google Ads copy and retargeting strategy",
      useCase:
        "Use AI to plan search ad angles, landing page expectations, and retargeting follow-up while keeping human review in the loop.",
      promptStarter:
        "Build a Google Ads starter plan for [market/persona]. Include compliant search ad themes, GA4 events to watch, and a retargeting follow-up sequence.",
    },
    successChecklist: [
      "Business Google account is used.",
      "GA4 property and web stream are created.",
      "Measurement ID or Google tag is captured.",
      "Google Ads account is created in Expert Mode.",
      "Google Ads and GA4 are linked.",
      "Google tag is saved in Website Settings.",
      "GA4 Realtime shows test activity.",
    ],
    commonMistakes: [
      "Using a personal Gmail that is hard to transfer later.",
      "Starting in Google Ads Smart Mode.",
      "Choosing the wrong GA4 time zone.",
      "Copying only part of the Google tag.",
      "Adding duplicate tracking scripts.",
    ],
  },
  {
    id: "google-website-visitor-audiences",
    title: "Google Website Visitor Audiences",
    category: "Retargeting Audience Setup",
    level: "501",
    estimatedTime: "10-15 minutes",
    audience:
      "Legends loan officers who have tracking installed and want to build remarketing audiences.",
    description:
      "Create a Google Ads website visitor segment from Audience Manager so site visitors can be retargeted and followed up with a cleaner strategy.",
    topics: [
      "Open Audience Manager",
      "Create a Website Visitors segment",
      "Name the audience clearly",
      "Set URL and membership rules",
      "Verify the segment configuration",
    ],
    nextAction:
      "Confirm the Google tag is installed before creating the audience.",
    aiPrompt: {
      title: "Website visitor audience naming and follow-up strategy",
      useCase:
        "Use AI to create a clear audience naming convention and practical follow-up plan for visitors by page or funnel.",
      promptStarter:
        "Create a naming convention and follow-up strategy for Google Ads website visitor audiences. Pages: [paste URLs]. Include audience names, intent level, nurture message, and review cautions.",
    },
    successChecklist: [
      "Google tag is installed and verified.",
      "Audience Manager is open.",
      "Website Visitors segment is selected.",
      "Segment name is clear and non-sensitive.",
      "URL rule is correct.",
      "Membership duration is intentional.",
      "Segment settings are reopened and verified.",
    ],
    commonMistakes: [
      "Creating an audience before tracking is installed.",
      "Using vague audience names.",
      "Targeting the wrong URL.",
      "Forgetting to prefill when available.",
      "Treating retargeting as a substitute for follow-up.",
    ],
  },
  {
    id: "lead-funnels-and-widgets",
    title: "Lead Funnels and Widgets",
    category: "Lead Capture & Website Widgets",
    level: "501",
    estimatedTime: "10-15 minutes",
    audience:
      "Legends loan officers with an external website, landing page, blog, or partner page.",
    description:
      "Create and embed lead widgets from the broker portal on external websites so visitors can request information, pricing, or an application path.",
    topics: [
      "Open Lead funnels and Widgets",
      "Review the SDK script",
      "Create a widget record",
      "Choose the widget type",
      "Copy the script and test the public page",
    ],
    nextAction: "Choose the landing page goal first, then create the widget.",
    aiPrompt: {
      title: "Lead funnel follow-up messaging",
      useCase:
        "Use AI to map each widget type to a follow-up message, lead source label, and next-step cadence.",
      promptStarter:
        "Build follow-up messaging for a website lead widget. Widget type: [quote form/long form/rate table/1003/basic form]. Include first text, first email, and pipeline next step. No rates, payments, guarantees, or approval claims.",
    },
    successChecklist: [
      "External website URL is known.",
      "Widget purpose is clear.",
      "SDK script is accounted for.",
      "Widget type matches the page goal.",
      "Lead source is entered.",
      "Generated script is copied.",
      "Public page is tested after embed.",
    ],
    commonMistakes: [
      "Skipping the SDK script.",
      "Choosing a widget before defining the page goal.",
      "Leaving lead source blank.",
      "Sending a developer a script without context.",
      "Assuming the widget is live without testing.",
    ],
  },
  {
    id: "website-settings-and-qm-pricer",
    title: "Website Settings and QM Pricer",
    category: "Website Setup & Quote Flow",
    level: "501",
    estimatedTime: "20-30 minutes",
    audience:
      "Legends loan officers configuring their broker portal website and quote/pricer experience.",
    description:
      "Review website visibility, profile content, custom scripts, and QM Pricer settings so the online experience supports traffic, quote requests, and follow-up.",
    topics: [
      "Review website URL and visibility",
      "Update profile, image, video, and bio",
      "Handle custom scripts carefully",
      "Review QM Pricer disclaimers and defaults",
      "Test the public quote flow",
    ],
    nextAction:
      "Review public website settings first, then verify QM Pricer settings and disclaimers.",
    aiPrompt: {
      title: "QM Pricer explanation and borrower friendly scripts",
      useCase:
        "Use AI to translate QM Pricer settings and quote flow into plain English scripts for borrowers, with compliance review.",
      promptStarter:
        "Draft a borrower-friendly explanation of how to use my website quote flow. No rates, payments, fees, approvals, or guarantees. Include a follow-up text after someone requests a quote.",
    },
    successChecklist: [
      "Website URL and visibility settings are reviewed.",
      "Email, phone, image, preview logo, and bio are current.",
      "Custom scripts are intentional and documented.",
      "QM Pricer disclaimers are reviewed.",
      "Default quote values are checked.",
      "Lender display and button settings are intentional.",
      "Public website and quote flow are tested.",
    ],
    commonMistakes: [
      "Leaving the website bio outdated.",
      "Adding tracking scripts without knowing what they do.",
      "Showing pricing buttons without a follow-up plan.",
      "Copying compensation settings without checking policy.",
      "Displaying too many terms and confusing consumers.",
    ],
    complianceCaution:
      "Jeremy's source material notes lender-paid compensation as the standard setup. Do not copy borrower-paid compensation settings from screenshots without explicit approval.",
  },
];

export function marketingCardsForLevel(level: "401" | "501"): MarketingCard[] {
  return marketingCards.filter((card) => card.level === level);
}

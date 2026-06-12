export type AiAdvantageVideoSection =
  | "Foundations"
  | "AI Twin Setup"
  | "Client Communication"
  | "Marketing & Content"
  | "Content Creation"
  | "AI Apps & Automation"
  | "Platform & Updates";

export type AiAdvantagePublishedVideo = {
  rowId: string;
  slug: string;
  title: string;
  description: string;
  youtubeVideoId: string;
  youtubeVideoUrl: string;
  youtubeEmbedUrl: string;
  status: "published";
  privacy: "unlisted";
  platformSection: "AI Advantage";
  source: "YouTube";
  librarySection: AiAdvantageVideoSection;
  pathSlug: string;
  sourceFileName: string;
  suggestedLessonPage: string;
  notes: string;
};

export const aiAdvantageVideoSectionOrder: AiAdvantageVideoSection[] = [
  "Foundations",
  "AI Twin Setup",
  "Client Communication",
  "Marketing & Content",
  "Content Creation",
  "AI Apps & Automation",
  "Platform & Updates",
];

export const aiAdvantagePublishedVideos = [
  {
    rowId: "AIADV-001",
    slug: "aiadv-001",
    title: "AI Advantage: AI Training Overview, Content Research and Automation",
    description:
      "Start here for the big-picture tour of AI Advantage, content research, and how these lessons help loan officers work faster with review.",
    youtubeVideoId: "c8zULkTrwGU",
    youtubeVideoUrl: "https://www.youtube.com/watch?v=c8zULkTrwGU",
    youtubeEmbedUrl: "https://www.youtube.com/embed/c8zULkTrwGU",
    status: "published",
    privacy: "unlisted",
    platformSection: "AI Advantage",
    source: "YouTube",
    librarySection: "Foundations",
    pathSlug: "notebooklm",
    sourceFileName:
      "ai-advantage__2026-04-14__ai-training-overview-content-research-and-automation__0000-0055.mp4",
    suggestedLessonPage:
      "/lo-development/ai-advantage/foundations/ai-training-overview",
    notes:
      "Series overview and orientation clip. Good as the first lesson in the library.",
  },
  {
    rowId: "AIADV-002",
    slug: "aiadv-002",
    title: "AI Advantage: AI Data Security for Loan Officers",
    description:
      "Learn the security basics: protect private information, keep borrower data out of AI tools, and use human review before anything leaves Loan Factory.",
    youtubeVideoId: "ozTujCSxaqE",
    youtubeVideoUrl: "https://www.youtube.com/watch?v=ozTujCSxaqE",
    youtubeEmbedUrl: "https://www.youtube.com/embed/ozTujCSxaqE",
    status: "published",
    privacy: "unlisted",
    platformSection: "AI Advantage",
    source: "YouTube",
    librarySection: "Foundations",
    pathSlug: "ai-safety",
    sourceFileName:
      "ai-advantage__2026-02-11__ai-data-security-for-loan-officers__1758-1917.mp4",
    suggestedLessonPage:
      "/lo-development/ai-advantage/foundations/ai-data-security-for-loan-officers",
    notes: "Compliance and security foundation. Pair early with onboarding.",
  },
  {
    rowId: "AIADV-003",
    slug: "aiadv-003",
    title: "AI Advantage: AI Powered Loan Status Updates",
    description:
      "Use AI to draft clearer loan status updates while keeping judgment, accuracy, and review in the process.",
    youtubeVideoId: "5BPKlTxCJPU",
    youtubeVideoUrl: "https://www.youtube.com/watch?v=5BPKlTxCJPU",
    youtubeEmbedUrl: "https://www.youtube.com/embed/5BPKlTxCJPU",
    status: "published",
    privacy: "unlisted",
    platformSection: "AI Advantage",
    source: "YouTube",
    librarySection: "Client Communication",
    pathSlug: "gmail-workspace",
    sourceFileName:
      "ai-advantage__2026-02-11__ai-powered-loan-status-updates__5645-5825.mp4",
    suggestedLessonPage:
      "/lo-development/ai-advantage/client-communication/ai-powered-loan-status-updates",
    notes: "Borrower communication automation.",
  },
  {
    rowId: "AIADV-004",
    slug: "aiadv-004",
    title: "AI Advantage: Automating your Daily Market Updates",
    description:
      "Turn daily market information into a repeatable draft workflow for reviewed education and follow-up content.",
    youtubeVideoId: "ti-AwZl14vk",
    youtubeVideoUrl: "https://www.youtube.com/watch?v=ti-AwZl14vk",
    youtubeEmbedUrl: "https://www.youtube.com/embed/ti-AwZl14vk",
    status: "published",
    privacy: "unlisted",
    platformSection: "AI Advantage",
    source: "YouTube",
    librarySection: "Marketing & Content",
    pathSlug: "social-realtor-marketing",
    sourceFileName:
      "ai-advantage__2026-02-11__automating-your-daily-market-updates__5144-5305.mp4",
    suggestedLessonPage:
      "/lo-development/ai-advantage/marketing/automating-daily-market-updates",
    notes: "Daily market content automation.",
  },
  {
    rowId: "AIADV-005",
    slug: "aiadv-005",
    title: "AI Advantage: Dominating your Local Market with AI",
    description:
      "Use local market context to create stronger education and marketing ideas without making claims that require review first.",
    youtubeVideoId: "dynRVCanBGA",
    youtubeVideoUrl: "https://www.youtube.com/watch?v=dynRVCanBGA",
    youtubeEmbedUrl: "https://www.youtube.com/embed/dynRVCanBGA",
    status: "published",
    privacy: "unlisted",
    platformSection: "AI Advantage",
    source: "YouTube",
    librarySection: "Marketing & Content",
    pathSlug: "google-business-profile",
    sourceFileName:
      "ai-advantage__2026-02-11__dominating-your-local-market-with-ai__3852-4100.mp4",
    suggestedLessonPage:
      "/lo-development/ai-advantage/marketing/dominating-your-local-market-with-ai",
    notes: "Local market and SEO angle.",
  },
  {
    rowId: "AIADV-006",
    slug: "aiadv-006",
    title: "AI Advantage: Drafting Client Emails in Gmail",
    description:
      "Draft clearer client emails in Gmail faster, then review every word before sending anything externally.",
    youtubeVideoId: "GBfe2N9Du64",
    youtubeVideoUrl: "https://www.youtube.com/watch?v=GBfe2N9Du64",
    youtubeEmbedUrl: "https://www.youtube.com/embed/GBfe2N9Du64",
    status: "published",
    privacy: "unlisted",
    platformSection: "AI Advantage",
    source: "YouTube",
    librarySection: "Client Communication",
    pathSlug: "gmail-workspace",
    sourceFileName:
      "ai-advantage__2026-02-11__drafting-client-emails-in-gmail__4340-4545.mp4",
    suggestedLessonPage:
      "/lo-development/ai-advantage/client-communication/drafting-client-emails-in-gmail",
    notes: "Gmail and Gemini drafting.",
  },
  {
    rowId: "AIADV-007",
    slug: "aiadv-007",
    title: "AI Advantage: Finalizing your Gemini Gem Setup",
    description:
      "Finish the Gemini Gem setup sequence so your AI helper is easier to use in practical loan officer workflows.",
    youtubeVideoId: "Saz-qFxCu1Y",
    youtubeVideoUrl: "https://www.youtube.com/watch?v=Saz-qFxCu1Y",
    youtubeEmbedUrl: "https://www.youtube.com/embed/Saz-qFxCu1Y",
    status: "published",
    privacy: "unlisted",
    platformSection: "AI Advantage",
    source: "YouTube",
    librarySection: "AI Twin Setup",
    pathSlug: "gemini-ai-twin",
    sourceFileName:
      "ai-advantage__2026-02-11__finalizing-your-gemini-gem-setup__0736-0907.mp4",
    suggestedLessonPage:
      "/lo-development/ai-advantage/ai-twin/finalizing-gemini-gem-setup",
    notes:
      "Part of the AI Twin setup sequence. Suggest ordering after Starting the AI Twin Setup.",
  },
  {
    rowId: "AIADV-008",
    slug: "aiadv-008",
    title: "AI Advantage: Gemini Gems vs Generic AI",
    description:
      "See why a role-specific Gemini Gem can produce cleaner, more consistent drafts than a generic AI chat.",
    youtubeVideoId: "3LzjDAMkk04",
    youtubeVideoUrl: "https://www.youtube.com/watch?v=3LzjDAMkk04",
    youtubeEmbedUrl: "https://www.youtube.com/embed/3LzjDAMkk04",
    status: "published",
    privacy: "unlisted",
    platformSection: "AI Advantage",
    source: "YouTube",
    librarySection: "AI Twin Setup",
    pathSlug: "gemini-ai-twin",
    sourceFileName:
      "ai-advantage__2026-02-11__gemini-gems-vs-generic-ai__0141-0317.mp4",
    suggestedLessonPage:
      "/lo-development/ai-advantage/ai-twin/gemini-gems-vs-generic-ai",
    notes: "Why custom Gems beat generic prompts.",
  },
  {
    rowId: "AIADV-009",
    slug: "aiadv-009",
    title: "AI Advantage: Improving AI Tone with Bio Docs",
    description:
      "Use approved background notes to help AI draft in a tone that sounds more like you while keeping review in place.",
    youtubeVideoId: "L_FBdXpkYG0",
    youtubeVideoUrl: "https://www.youtube.com/watch?v=L_FBdXpkYG0",
    youtubeEmbedUrl: "https://www.youtube.com/embed/L_FBdXpkYG0",
    status: "published",
    privacy: "unlisted",
    platformSection: "AI Advantage",
    source: "YouTube",
    librarySection: "AI Twin Setup",
    pathSlug: "gemini-ai-twin",
    sourceFileName:
      "ai-advantage__2026-02-11__improving-ai-tone-with-bio-docs__1406-1650.mp4",
    suggestedLessonPage:
      "/lo-development/ai-advantage/ai-twin/improving-ai-tone-with-bio-docs",
    notes: "Personalization via bio documents.",
  },
  {
    rowId: "AIADV-010",
    slug: "aiadv-010",
    title: "AI Advantage: Multi Language Content Strategy",
    description:
      "Plan bilingual and multilingual outreach drafts with plain-language review before anything is used publicly.",
    youtubeVideoId: "uBSDv9RVgaQ",
    youtubeVideoUrl: "https://www.youtube.com/watch?v=uBSDv9RVgaQ",
    youtubeEmbedUrl: "https://www.youtube.com/embed/uBSDv9RVgaQ",
    status: "published",
    privacy: "unlisted",
    platformSection: "AI Advantage",
    source: "YouTube",
    librarySection: "Marketing & Content",
    pathSlug: "social-realtor-marketing",
    sourceFileName:
      "ai-advantage__2026-02-11__multi-language-content-strategy__1200-1405.mp4",
    suggestedLessonPage:
      "/lo-development/ai-advantage/marketing/multi-language-content-strategy",
    notes: "Bilingual and multilingual outreach.",
  },
  {
    rowId: "AIADV-011",
    slug: "aiadv-011",
    title: "AI Advantage: Rapid Content Creation with AI Twin",
    description:
      "Move faster from idea to draft by using an AI Twin to produce starter content for review. Edit the tone, verify facts, and keep human review in the loop before public use.",
    youtubeVideoId: "q3aN611Kv3w",
    youtubeVideoUrl: "https://www.youtube.com/watch?v=q3aN611Kv3w",
    youtubeEmbedUrl: "https://www.youtube.com/embed/q3aN611Kv3w",
    status: "published",
    privacy: "unlisted",
    platformSection: "AI Advantage",
    source: "YouTube",
    librarySection: "Marketing & Content",
    pathSlug: "social-realtor-marketing",
    sourceFileName:
      "ai-advantage__2026-02-11__rapid-content-creation-with-ai-twin__0908-1136.mp4",
    suggestedLessonPage:
      "/lo-development/ai-advantage/marketing/rapid-content-creation-with-ai-twin",
    notes: "AI Twin powered content velocity. Pair with the AI Twin setup track.",
  },
  {
    rowId: "AIADV-012",
    slug: "aiadv-012",
    title: "AI Advantage: Starting the AI Twin Setup",
    description:
      "Begin the AI Twin setup track with the first practical steps for a Gemini-based loan officer helper.",
    youtubeVideoId: "zNwOFHZ2XbM",
    youtubeVideoUrl: "https://www.youtube.com/watch?v=zNwOFHZ2XbM",
    youtubeEmbedUrl: "https://www.youtube.com/embed/zNwOFHZ2XbM",
    status: "published",
    privacy: "unlisted",
    platformSection: "AI Advantage",
    source: "YouTube",
    librarySection: "AI Twin Setup",
    pathSlug: "gemini-ai-twin",
    sourceFileName:
      "ai-advantage__2026-02-11__starting-the-ai-twin-setup__0318-0510.mp4",
    suggestedLessonPage:
      "/lo-development/ai-advantage/ai-twin/starting-ai-twin-setup",
    notes:
      "Entry point for the AI Twin setup track. Suggest ordering before Finalizing your Gemini Gem Setup.",
  },
  {
    rowId: "AIADV-013",
    slug: "aiadv-013",
    title: "AI Advantage: Training Your AI on Your Persona",
    description:
      "Feed your AI Twin the approved persona details that shape its tone and style. Keep private borrower data out and review everything that gets used externally.",
    youtubeVideoId: "92ziHhq7vzQ",
    youtubeVideoUrl: "https://www.youtube.com/watch?v=92ziHhq7vzQ",
    youtubeEmbedUrl: "https://www.youtube.com/embed/92ziHhq7vzQ",
    status: "published",
    privacy: "unlisted",
    platformSection: "AI Advantage",
    source: "YouTube",
    librarySection: "AI Twin Setup",
    pathSlug: "gemini-ai-twin",
    sourceFileName:
      "ai-advantage__2026-02-11__training-your-ai-on-your-persona__0511-0735.mp4",
    suggestedLessonPage:
      "/lo-development/ai-advantage/ai-twin/training-your-ai-on-your-persona",
    notes: "Persona tuning step in the AI Twin setup sequence.",
  },
  {
    rowId: "AIADV-014",
    slug: "aiadv-014",
    title: "AI Advantage: Why Every Loan Officer Needs an AI Twin",
    description:
      "See the why behind the AI Twin: faster drafts, more consistent tone, and a starting point you still review before anything leaves Loan Factory.",
    youtubeVideoId: "BS9JBfg5XIw",
    youtubeVideoUrl: "https://www.youtube.com/watch?v=BS9JBfg5XIw",
    youtubeEmbedUrl: "https://www.youtube.com/embed/BS9JBfg5XIw",
    status: "published",
    privacy: "unlisted",
    platformSection: "AI Advantage",
    source: "YouTube",
    librarySection: "AI Twin Setup",
    pathSlug: "gemini-ai-twin",
    sourceFileName:
      "ai-advantage__2026-02-11__why-every-loan-officer-needs-an-ai-twin__0000-0140.mp4",
    suggestedLessonPage:
      "/lo-development/ai-advantage/ai-twin/why-every-loan-officer-needs-an-ai-twin",
    notes: "Orientation lesson for the AI Twin setup track.",
  },
  {
    rowId: "AIADV-015",
    slug: "aiadv-015",
    title: "AI Advantage: Creating Video Content with HeyGen AI Clones",
    description:
      "See how AI video can support training and content planning when scripts and public use are reviewed first.",
    youtubeVideoId: "AC-jBgffnHc",
    youtubeVideoUrl: "https://www.youtube.com/watch?v=AC-jBgffnHc",
    youtubeEmbedUrl: "https://www.youtube.com/embed/AC-jBgffnHc",
    status: "published",
    privacy: "unlisted",
    platformSection: "AI Advantage",
    source: "YouTube",
    librarySection: "Content Creation",
    pathSlug: "heygen-ai-video",
    sourceFileName:
      "ai-advantage__2026-03-03__creating-video-content-with-heygen-ai-clones__1248-1440.mp4",
    suggestedLessonPage:
      "/lo-development/ai-advantage/content-creation/heygen-ai-clones",
    notes: "Video avatar production.",
  },
  {
    rowId: "AIADV-016",
    slug: "aiadv-016",
    title: "AI Advantage: Overview Marketing with NotebookLM and AI Twins",
    description:
      "Use source-grounded research and AI Twins to organize marketing ideas before review and use.",
    youtubeVideoId: "Jou4jrGFKsg",
    youtubeVideoUrl: "https://www.youtube.com/watch?v=Jou4jrGFKsg",
    youtubeEmbedUrl: "https://www.youtube.com/embed/Jou4jrGFKsg",
    status: "published",
    privacy: "unlisted",
    platformSection: "AI Advantage",
    source: "YouTube",
    librarySection: "Marketing & Content",
    pathSlug: "notebooklm",
    sourceFileName:
      "ai-advantage__2026-03-03__overview-marketing-with-notebooklm-and-ai-twins__0933-1100.mp4",
    suggestedLessonPage:
      "/lo-development/ai-advantage/marketing/notebooklm-ai-twins-overview",
    notes: "NotebookLM plus AI Twin marketing overview.",
  },
  {
    rowId: "AIADV-017",
    slug: "aiadv-017",
    title: "AI Advantage: Upcoming Updates to Loan Factory's MOS Platform",
    description:
      "Preview the direction of Loan Factory's MOS platform updates so you can plan training time and workflow changes ahead of release. Always confirm specifics with internal release notes before publishing anything externally.",
    youtubeVideoId: "wN3AIyOLFEU",
    youtubeVideoUrl: "https://www.youtube.com/watch?v=wN3AIyOLFEU",
    youtubeEmbedUrl: "https://www.youtube.com/embed/wN3AIyOLFEU",
    status: "published",
    privacy: "unlisted",
    platformSection: "AI Advantage",
    source: "YouTube",
    librarySection: "Platform & Updates",
    pathSlug: "google-ai-studio",
    sourceFileName:
      "ai-advantage__2026-03-03__upcoming-updates-to-loan-factory-s-mos-platform__0732-0932.mp4",
    suggestedLessonPage:
      "/lo-development/ai-advantage/platform-updates/loan-factory-mos-platform",
    notes:
      "Loan Factory MOS platform direction. Internal preview only; confirm with official release notes.",
  },
  {
    rowId: "AIADV-018",
    slug: "aiadv-018",
    title: "AI Advantage: 3 Essential AI Apps for Loan Officers",
    description:
      "A short tour of three AI apps that can save loan officers time on prep, drafts, and follow-up. Use them as draft helpers and keep human review in the loop.",
    youtubeVideoId: "t5YVs8Ry7jU",
    youtubeVideoUrl: "https://www.youtube.com/watch?v=t5YVs8Ry7jU",
    youtubeEmbedUrl: "https://www.youtube.com/embed/t5YVs8Ry7jU",
    status: "published",
    privacy: "unlisted",
    platformSection: "AI Advantage",
    source: "YouTube",
    librarySection: "AI Apps & Automation",
    pathSlug: "custom-gpts",
    sourceFileName:
      "ai-advantage__2026-03-17__3-essential-ai-apps-for-loan-officers__0101-0320.mp4",
    suggestedLessonPage:
      "/lo-development/ai-advantage/ai-apps/3-essential-ai-apps-for-loan-officers",
    notes: "Tool selection orientation for AI app evaluation.",
  },
  {
    rowId: "AIADV-019",
    slug: "aiadv-019",
    title: "AI Advantage: Advanced AI App Building / Vibe Coding",
    description:
      "Explore how loan officers can sketch and build their own internal AI helpers. Bring any new build to LO Development for review before connecting it to live workflows.",
    youtubeVideoId: "hBFNvV8hueE",
    youtubeVideoUrl: "https://www.youtube.com/watch?v=hBFNvV8hueE",
    youtubeEmbedUrl: "https://www.youtube.com/embed/hBFNvV8hueE",
    status: "published",
    privacy: "unlisted",
    platformSection: "AI Advantage",
    source: "YouTube",
    librarySection: "AI Apps & Automation",
    pathSlug: "google-ai-studio",
    sourceFileName:
      "ai-advantage__2026-03-17__advanced-ai-app-building-vibe-coding__1340-1659.mp4",
    suggestedLessonPage:
      "/lo-development/ai-advantage/ai-apps/advanced-ai-app-building-vibe-coding",
    notes:
      "AI app building / vibe coding intro. Builds must go through LO Development before live connections.",
  },
  {
    rowId: "AIADV-020",
    slug: "aiadv-020",
    title: "AI Advantage: Automating Social Media with Loan Factory Ally",
    description:
      "See how Loan Factory Ally helps loan officers organize and draft social posts faster. Review tone, claims, and compliance-sensitive language before anything is scheduled or published.",
    youtubeVideoId: "S6qXWfcryMI",
    youtubeVideoUrl: "https://www.youtube.com/watch?v=S6qXWfcryMI",
    youtubeEmbedUrl: "https://www.youtube.com/embed/S6qXWfcryMI",
    status: "published",
    privacy: "unlisted",
    platformSection: "AI Advantage",
    source: "YouTube",
    librarySection: "AI Apps & Automation",
    pathSlug: "social-realtor-marketing",
    sourceFileName:
      "ai-advantage__2026-03-17__automating-social-media-with-loan-factory-ally__2754-3220.mp4",
    suggestedLessonPage:
      "/lo-development/ai-advantage/ai-apps/automating-social-media-with-loan-factory-ally",
    notes: "Social automation with Loan Factory Ally.",
  },
  {
    rowId: "AIADV-021",
    slug: "aiadv-021",
    title: "AI Advantage: Creating an AI Twin for Multilingual Marketing",
    description:
      "Plan a multilingual AI Twin so you can serve borrowers in more than one language. Use plain-language review and an approved translator step before public use.",
    youtubeVideoId: "A2XyhL3S7vQ",
    youtubeVideoUrl: "https://www.youtube.com/watch?v=A2XyhL3S7vQ",
    youtubeEmbedUrl: "https://www.youtube.com/embed/A2XyhL3S7vQ",
    status: "published",
    privacy: "unlisted",
    platformSection: "AI Advantage",
    source: "YouTube",
    librarySection: "AI Apps & Automation",
    pathSlug: "gemini-ai-twin",
    sourceFileName:
      "ai-advantage__2026-03-17__creating-an-ai-twin-for-multilingual-marketing__5246-5510.mp4",
    suggestedLessonPage:
      "/lo-development/ai-advantage/ai-apps/creating-an-ai-twin-for-multilingual-marketing",
    notes: "Multilingual AI Twin for bilingual outreach.",
  },
  {
    rowId: "AIADV-052",
    slug: "aiadv-052",
    title: "AI Advantage: How to Build your Public Loan Officer AI Twin",
    description:
      "Review how a public-facing loan officer AI Twin can be planned. Do not publish or share one until content, disclosures, guardrails, and compliance review are approved.",
    youtubeVideoId: "kH9VDBwwuh0",
    youtubeVideoUrl: "https://www.youtube.com/watch?v=kH9VDBwwuh0",
    youtubeEmbedUrl: "https://www.youtube.com/embed/kH9VDBwwuh0",
    status: "published",
    privacy: "unlisted",
    platformSection: "AI Advantage",
    source: "YouTube",
    librarySection: "AI Twin Setup",
    pathSlug: "gemini-ai-twin",
    sourceFileName:
      "ai-advantage__2026-04-28__how-to-build-your-public-loan-officer-ai-twin__0737-0843.mp4",
    suggestedLessonPage:
      "/lo-development/ai-advantage/ai-twin/public-loan-officer-ai-twin",
    notes: "Public-facing AI Twin build.",
  },
  {
    rowId: "AIADV-056",
    slug: "aiadv-056",
    title: "AI Advantage: Automate your Social Posts with Gemini AI",
    description:
      "Use Gemini to draft social post ideas faster, then review tone, claims, and compliance-sensitive language before use.",
    youtubeVideoId: "AFPffFdcmQo",
    youtubeVideoUrl: "https://www.youtube.com/watch?v=AFPffFdcmQo",
    youtubeEmbedUrl: "https://www.youtube.com/embed/AFPffFdcmQo",
    status: "published",
    privacy: "unlisted",
    platformSection: "AI Advantage",
    source: "YouTube",
    librarySection: "Marketing & Content",
    pathSlug: "social-realtor-marketing",
    sourceFileName:
      "ai-advantage__2026-05-12__automate-your-social-posts-with-gemini-ai__2532-3304.mp4",
    suggestedLessonPage:
      "/lo-development/ai-advantage/marketing/automate-social-posts-with-gemini-ai",
    notes: "Social posting automation with Gemini.",
  },
] satisfies AiAdvantagePublishedVideo[];

export function getAiAdvantagePublishedVideo(slug: string) {
  return aiAdvantagePublishedVideos.find((video) => video.slug === slug);
}

export function getAiAdvantagePublishedVideosForPath(pathSlug: string) {
  return aiAdvantagePublishedVideos.filter((video) => video.pathSlug === pathSlug);
}

export function getAiAdvantagePublishedVideosForSection(
  section: AiAdvantageVideoSection,
) {
  return aiAdvantagePublishedVideos.filter(
    (video) => video.librarySection === section,
  );
}

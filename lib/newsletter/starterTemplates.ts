// Curated newsletter starter templates for Email Studio.
//
// These render as "Start from template" cards on /email when the
// organization has zero email_campaigns rows. They are intentionally
// premium-mortgage-flavored (rate moves, refi outreach, relationship
// check-ins) rather than the generic "Hello {{first_name}}" boilerplate
// you'd get from a default starter pack.
//
// The body is Markdown — it round-trips through lib/email/render.ts the
// same way an AI-written or hand-typed draft does, so what the owner
// sees in the composer preview is what ships to the audience inbox.

export interface StarterTemplate {
  key: string;
  subject: string;
  preview_text: string;
  body_markdown: string;
  /**
   * Short blurb shown in the picker card. Keep <= 90 chars.
   */
  blurb: string;
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    key: "starter_monthly_checkin",
    subject: "Monthly mortgage check-in — what we're watching in May",
    preview_text:
      "A quick read on rates, programs, and the deals we're closing this month.",
    blurb:
      "Warm, no-pressure relationship touch. Pairs well with your full realtor list.",
    body_markdown: `# Monthly mortgage check-in

Hope your month is off to a strong start. Here's a quick read on what's
moving in the mortgage market and where we're finding wins for our
realtor partners and their buyers.

**Three things worth your attention this month:**

- 30-year fixed has been trading in a tight range — qualifying power is
  holding steady for pre-approvals refreshed in the last 60 days.
- We re-opened a niche **non-QM program for self-employed buyers**
  (12-month bank statements, no tax returns required).
- Down-payment assistance volumes are up — if you have a first-time
  buyer who passed earlier this year, it may be worth a second look.

If any of your active clients want a fresh second-look or a quick
qualifying scenario, I keep two slots open on Fridays for partner
referrals.

[Schedule a call](#)

— Jeremy
`,
  },
  {
    key: "starter_rates_moved",
    subject: "Rates moved — what it means for your buyers this week",
    preview_text:
      "A 90-second read on this week's rate move and the buyers it actually affects.",
    blurb:
      "Send the week of any meaningful 10-year Treasury move. High open-rate driver.",
    body_markdown: `# Rates moved — here's the practical read

The 10-year shifted enough this week to nudge our daily rate sheet, and
I wanted to get ahead of the questions your clients are about to ask.

**What this changes:**

- Buyers who were pre-approved more than 30 days ago should refresh —
  qualifying payment can move a few hundred dollars in either direction.
- Pending offers with rate locks are unaffected. Locks hold.
- Refi files we shelved at higher coupons (anyone above ~7.25%) are
  worth a second look — I'll re-run the math for free, no commitment.

**What stays the same:**

- Program guidelines, DPA stacks, and our turn times.
- The two-week pre-approval-to-CTC pace your buyers can lean on.

If a specific client comes to mind, forward this email and CC me — I'll
take it from there.

[Run a quick scenario](#)

— Jeremy
`,
  },
  {
    key: "starter_spring_refi",
    subject: "Spring refi outreach — three windows worth reopening",
    preview_text:
      "Three buyer profiles in your pipeline who likely have a refi opportunity right now.",
    blurb:
      "Hand this to realtor partners as a co-branded outreach. Drives warm callbacks.",
    body_markdown: `# Spring refi outreach

I pulled the last 18 months of closings to flag the buyers most likely
to win from a refi conversation this spring. Three patterns kept coming
up — if any of these match a client in your CRM, it's a worthwhile
30-second check-in.

**Profile 1 — bought in late 2023 / early 2024.**
Their rate is probably 6.75% – 7.5%. Even a half-point drop pays back
in under 24 months on a typical $450k loan around here.

**Profile 2 — used a buy-down or seller credit at close.**
Their effective rate is dropping when the temporary buy-down expires.
Worth re-running the math now so they aren't surprised.

**Profile 3 — added a HELOC or 2nd in the last year.**
A cash-out refi can roll both into one fixed payment, often saving real
money even without a meaningful rate drop.

I'm happy to do the math on any name you send over — no obligation, no
hard pitch to your client. You see the numbers first.

[Send me a name](#)

— Jeremy
`,
  },
];

export function getStarterTemplateByKey(
  key: string
): StarterTemplate | undefined {
  return STARTER_TEMPLATES.find((t) => t.key === key);
}

# Legends Team Persona System — Plan

**Status:** Planning. No code authorized yet.
**Date:** 2026-05-22
**Target:** LegendsOSv2.0
**Source:** Loan Factory `LO_DEVELOPMENT_MARKET_RESPONSE_PANEL_PERSONAS.md`, `LO_DEVELOPMENT_AI_PANEL_SCORING_RUBRIC.md`, Audience Quality Panel concept

---

## 1. What this system is

A **persona library** that powers two things inside LegendsOS:

1. **Roleplay Lab** — Atlas-driven practice scenarios where the AI plays a specific persona (first-time buyer, jumbo borrower, Realtor partner, recapture target, lender AE, etc.) and the loan officer practices the conversation.
2. **Marketing copy persona scoring (optional)** — when a Legends member drafts marketing copy, an opt-in panel scores it against 3–4 target personas before publishing. Pulled forward from the LF "Audience Quality Panel" concept, scoped much smaller.

It also serves as a **team member persona system** — internal Legends LO profiles with their market focus, language, state coverage, certifications, and learning style. These power coaching routing and roleplay matching.

## 2. Two persona surfaces

| Surface | Audience | Storage |
|---|---|---|
| **Market personas** (external archetypes — buyers, partners, lenders) | All Legends members | `knowledge_collections` slug `legends-market-personas` |
| **Team member personas** (internal Legends LO profiles) | Owner + member's own profile | `profiles` table (extended) + `legends_lo_profile` if extended |

The two are kept separate because their access rules differ: market personas are read-shared across the team; team member personas are mostly self-owned + owner-visible.

## 3. Market personas

Adapted from `LO_DEVELOPMENT_MARKET_RESPONSE_PANEL_PERSONAS.md`. Rewritten for Legends voice and the mortgage-specific contexts Legends LOs actually face.

Starter set (Phase 1):

| Slug | Display name | Used for |
|---|---|---|
| `first-time-buyer` | First-Time Buyer | Roleplay, marketing copy scoring |
| `move-up-buyer` | Move-Up Buyer | Roleplay, marketing copy scoring |
| `jumbo-buyer` | Jumbo Buyer | Roleplay |
| `fha-buyer` | FHA Buyer | Roleplay |
| `va-buyer` | VA Buyer | Roleplay |
| `dscr-investor` | DSCR Investor | Roleplay |
| `refi-candidate` | Refi Candidate | Roleplay |
| `recapture-target` | Recapture Target (past client) | Roleplay |
| `realtor-partner` | Realtor Partner | Roleplay (partnership conversations) |
| `lender-ae` | Lender AE | Roleplay (escalation conversations) |
| `referral-source` | Referral Source (CPA / attorney / financial advisor) | Roleplay, marketing copy scoring |

Each persona has:

```ts
{
  slug: string;
  displayName: string;
  archetypeSummary: string;     // 2-3 sentence summary
  goals: string[];
  objections: string[];
  language: 'plain' | 'technical' | 'mixed';
  emotionalState: string;
  triggerPoints: string[];
  complianceNotes: string[];    // what the AI is forbidden to say in-persona
  rolePlaySystemPrompt: string; // the system prompt Atlas uses when this persona is active
  scoringRubricNotes: string[]; // signals that copy resonates with this persona
}
```

Persona definitions are stored as `knowledge_items` rows tagged with the collection slug and the metadata above as `data` JSON.

## 4. Team member personas

Each Legends LO has a profile that captures their:

- Role / title (LO, Senior LO, Team Lead, Coach, Owner)
- Market focus (purchase / refi / DSCR / VA / FHA / jumbo / investor / etc.)
- Languages spoken
- Licensed states
- Years of experience
- Production tier (Foundational / Growth / Mastery / Elite — internal Legends labels)
- Learning style (audio / video / reading / hands-on)
- Strengths and growth edges (free text, member-editable)
- Certifications earned
- Active goals (current sprint, year, longer-term)

Schema approach: extend `profiles` with a `legends_profile` JSONB column rather than introducing a new table. Reuses existing RLS. Owner can see all, member can see own.

```sql
ALTER TABLE profiles
  ADD COLUMN legends_profile JSONB NOT NULL DEFAULT '{}'::jsonb;
```

(Migration filename: `supabase/migrations/20260601000000_legends_profile_extension.sql`. Not authorized yet — gated on sprint approval.)

## 5. How the system powers Roleplay Lab

Workflow:

1. Member opens `/training/roleplay`.
2. Sees grid of personas with archetype summary + objections.
3. Clicks "Practice".
4. Opens a new Atlas thread with that persona's `rolePlaySystemPrompt` injected.
5. Atlas plays the persona; member practices the conversation.
6. At the end of a thread, member can hit "Score this practice" — Atlas summarizes how the conversation went, what worked, what to refine.
7. Score is stored in `chat_threads.metadata.rolePlayScore` for later review.

No real client data is ever fed into roleplay. Borrower PII is forbidden in roleplay threads (enforced via audit).

## 6. How the system powers marketing copy scoring (optional, Phase 3)

Workflow:

1. Member drafts a social post or email in the relevant studio.
2. Optional "Score against personas" button.
3. Member picks 1–3 target personas.
4. Atlas runs the draft through the scoring rubric per persona.
5. Returns a rubric score + specific suggestions.
6. Member edits and re-scores (or ignores).

This is **opt-in coaching, not a gate**. The user can always publish without scoring.

## 7. Phasing

### Phase 1 — Market persona library (Roleplay-ready)

- Seed 11 market personas into `knowledge_items` under `legends-market-personas`.
- Build `/training/roleplay` listing personas.
- Wire "Practice" button → new Atlas thread with persona prompt.
- Add `chat_threads.metadata.persona` field convention (no schema change required — `metadata` is already JSONB).
- Smoke: clicking Practice on each persona opens a thread with the correct prompt.

### Phase 2 — Team member persona schema

- Migration: extend `profiles` with `legends_profile JSONB`.
- Build `/settings/profile` extension form (market focus, languages, states, etc.).
- Build `/admin/users/[userId]` panel showing the legends_profile JSON in a readable layout (owner-only).
- No public surface for team member personas — internal coaching only.

### Phase 3 — Scoring rubric integration (defer until model live)

- Build scoring rubric prompt template (adapted from `LO_DEVELOPMENT_AI_PANEL_SCORING_RUBRIC.md`).
- Add "Score against personas" button in `/social` and `/email` composers.
- Wire `/api/ai/chat` extension for scoring requests.
- Display rubric output as inline coaching panel.

### Phase 4 — Persona-aware Atlas tool router

- Atlas detects "draft a post for first-time buyers" → applies the `first-time-buyer` persona scoring automatically on the resulting draft.
- Coaching surfaced inline with the draft.

## 8. Data shape examples

### Market persona example (first-time buyer)

```json
{
  "slug": "first-time-buyer",
  "displayName": "First-Time Buyer",
  "archetypeSummary": "Renter, 28-34, has a partner, saving for down payment. Anxious about whether they qualify. Researches obsessively on Reddit and TikTok. Wants someone who will explain without talking down to them.",
  "goals": [
    "Find out what they can actually afford",
    "Understand FHA vs conventional",
    "Avoid feeling judged"
  ],
  "objections": [
    "I don't have 20% down",
    "My credit isn't perfect",
    "I'm scared of being house poor",
    "I want a second opinion"
  ],
  "language": "plain",
  "emotionalState": "excited but guarded",
  "triggerPoints": [
    "Being told what they want to hear vs the truth",
    "Surprise fees",
    "Pressure to make a decision before they understand"
  ],
  "complianceNotes": [
    "No rate quote in roleplay — practice the framing, not the number",
    "No promise of approval",
    "Always offer the 'let me show you how it works' framing"
  ],
  "rolePlaySystemPrompt": "You are a 30-year-old first-time homebuyer named Sam... [full prompt body]",
  "scoringRubricNotes": [
    "Resonant copy uses plain English, no jargon",
    "Acknowledges the down payment fear before pitching",
    "Offers next-step language not commitment language",
    "Includes a 'here is what to expect' framing"
  ]
}
```

### Team member persona example (extracted profile JSON)

```json
{
  "title": "Senior LO",
  "marketFocus": ["purchase", "refi", "VA"],
  "languages": ["English", "Spanish"],
  "states": ["FL", "GA"],
  "yearsExperience": 8,
  "productionTier": "Mastery",
  "learningStyle": ["audio", "video"],
  "strengths": ["recapture", "Realtor partner relationships"],
  "growthEdges": ["jumbo product knowledge"],
  "certifications": ["VA Certified", "FHA Certified"],
  "activeGoals": {
    "sprint": "Add 3 new Realtor partners in Q3",
    "year": "Reach 60 units"
  }
}
```

## 9. Branding and content rules

- Personas use Legends voice. No Loan-Factory-only objections or scenarios.
- Personas never demand the AI quote a rate, fee, or approval — the AI's first move when a persona asks is "let me show you how to frame this without quoting numbers."
- Persona definitions are stored as **internal team-only** items. No public sharing.
- All persona prompts include the standard compliance prelude (no rate, no APR, no underwriting decisions).
- Roleplay transcripts are stored locally to the team. Owner can review for coaching. They are **not** training data for any external model.

## 10. Open questions for Jeremy

1. Confirm 11 personas as the starter set or trim/extend.
2. Should Realtor and lender-AE roleplay personas live in the same library or split?
3. Production tier labels: Foundational / Growth / Mastery / Elite — pick or rename.
4. Should team member personas be self-edit (member-managed) or owner-managed?
5. Should scoring rubric ship in Phase 1 (catalog-only display) or wait for Phase 3?

## 11. Out of scope

- Public-facing buyer matching tools.
- Full Audience Quality Panel UI as a gate before publish (LF's version) — Legends keeps it opt-in coaching.
- Multi-language persona prompts (English only in Phase 1).
- Persona-driven CRM segmentation (Legends has no CRM inside LegendsOS).
- Borrower-PII-aware coaching (forbidden by design).

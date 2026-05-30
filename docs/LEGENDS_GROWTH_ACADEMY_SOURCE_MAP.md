# Legends Growth Academy — Source Map

**Status:** Discovery / planning. No code authorized to ship from this doc yet.
**Date:** 2026-05-22
**Owner:** Jeremy McDonald · The Legends Mortgage Team powered by Loan Factory
**Target system:** LegendsOSv2.0
**Source system:** Loan Factory LO Development Platform (prototype repo `loan-factory-elite-sales-marketing-training`)

---

## 1. Purpose

This document maps every source artifact from the Loan Factory LO Development Platform package into a target location inside LegendsOSv2.0. It is the canonical reference for the "Legends Growth Academy" module — the Legends-branded internal adaptation of the LO Development training, coaching, AI assistant, and community surfaces.

Source materials are treated as **research and adaptation input only**. They are not copied verbatim into LegendsOS. Branding, copy, role model, and workflow shape are rewritten for The Legends Mortgage Team.

## 2. Source inventory (already on disk)

| Source | Path | Role in mapping |
|---|---|---|
| Loan Factory LO Development repo | `/loan-factory-product-starter-kit/apps/loan-factory-elite-sales-marketing-training` | Reference Next.js app (routes, data files, components). Read-only for this task. |
| Handoff package | `/_staging/lo-development-codex-handoff-review/lo-development-codex-handoff` | 15 markdown maps + safe-docs/screenshots/source-lists. Primary planning input. |
| Training videos | `/Loan Factory AI Training Videos` | YouTube + HeyGen video catalog. Reference only for embed list. |
| Logos | `/lo-development-platform-logos` | Loan Factory marks. Not used as LegendsOS branding. |

## 3. Branding translation

LegendsOS is for The Legends Mortgage Team. It is "powered by Loan Factory" (per `package.json` copyright) but it is **not** the Loan Factory LO Development Platform. Naming is reframed.

| Loan Factory source name | Legends adaptation (working) | Notes |
|---|---|---|
| Loan Factory LO Development Platform | Legends Growth OS (umbrella) | New umbrella; Legends Growth Academy is the training/coaching pillar inside it. |
| Elite Sales and Marketing Training 101–601 | Legends Sales Academy (101–601 track) | Curriculum scope preserved; copy/voice rewritten for Legends. |
| LO Mastery Coaching (Level I, paid) | Legends Mastery Track (internal) | Internal Legends version. No paid tier in LegendsOS — this is internal team development. |
| Loan Factory Alliance (Level II, paid) | Legends Elite Track (internal) | Same: internal, no payment. |
| AI Assistant Hub | Legends Assistant Hub (extends `/atlas`) | Already partially live as Atlas + assistant subsystem. |
| FaceGram | Deferred. Optional future "Legends Lounge" only if team size warrants it. | Slack/Discord covers current internal social. |
| Training Library | Legends Library (extends `/training` + `/knowledge`) | Catalog of recordings, scripts, roleplays, audio, decks, handouts. |
| Team Leader OS | Legends Team Lead OS | Adapt for Legends team structure. |
| Corporate Coach Hub | Legends Coach Hub (Jeremy-led) | Single-coach prototype for Legends. |

Rules carried forward from source:
- Use **LO** or **loan officer**, never ELO.
- Use **TERA** as the LOS/POS/CRM term, never MOSO.
- Loan Factory has no public API — no code or copy should claim otherwise.
- No rate / fee / APR / approval / underwriting claims from Legends AI surfaces.
- No "free processing," "lowest rate," or production guarantees.

## 4. LO Development → LegendsOS surface map

Each row names a concept on the source side, the LegendsOSv2.0 surface that already exists or should host the adapted version, and the docs to read before scaffolding.

| Source concept | LegendsOSv2.0 target | Existing? | Primary source docs |
|---|---|---|---|
| Elite Sales & Marketing 101–601 curriculum | `/training` → expand into `/training/academy/[track]/[module]` | `/training` exists | `SALES_MARKETING_SOURCE_MAP.md` |
| 101 video / 7 HeyGen avatar videos | Add to `lib/teamResources.ts` as Legends-tagged catalog entries | partial | `VIDEO_LINKS_AND_EMBEDS.md` |
| 5 unintegrated audio briefs | Add Legends-curated subset to `/training` audio block | not yet wired | `AI_TRAINING_SOURCE_MAP.md` |
| Scripts library | New `/shared/scripts` slot inside Shared Resources or new top-level if scope grows | `/shared` exists | `BUILD_CONTEXT.md` §2.6 |
| Roleplay Lab | New `/training/roleplay` sub-route | not yet | `BUILD_CONTEXT.md` §2.6 |
| Trackers (Activity, Scorecard, 90-Day Ramp, QBR, Recognition, Recruiting) | New `lib/legends/trackers/` + `/dashboard/trackers` | not yet | `COACHING_PROGRAM_SOURCE_MAP.md` §03_Tracker_Forms, §04_CSV_Templates |
| Persona library (market personas, panel personas) | New `/knowledge/personas` collection seed | not yet | `LO_DEVELOPMENT_MARKET_RESPONSE_PANEL_PERSONAS.md` |
| LO Mastery / Alliance member landings | Internal Legends "tracks" inside `/training/academy` (no public tier pages) | not yet | `COACHING_PROGRAM_SOURCE_MAP.md`, `05_Dashboard_Specs/Member_Dashboard_Spec.md` |
| Three primary AI assistants (LO Support, Marketing Support, General) | `/atlas` with three named assistants in `atlas_assistants` table | `/atlas` exists | `AI_ASSISTANT_KNOWLEDGE_MAP.md` |
| Prompt Library Assistant | `/knowledge` collection + Atlas tool | partial | `AI_TRAINING_SOURCE_MAP.md` §Prompt Library |
| FaceGram | **Deferred.** Optional future `/social` extension. | n/a | `FACEGRAM_SOURCE_MAP.md` (reference only) |
| Team Leader OS | `/training/team-lead-os` or `/admin/team-lead-os` (owner-only) | not yet | `Loan_Factory_Team_Leader_Operating_System.pdf`, `Team_Leader_Dashboard_Spec.md` |
| Corporate Coach Hub | Defer until Legends has multiple coaches | n/a | `Coach_Dashboard_Spec.md` |
| Coaching Calendar | Extend `/calendar` with `category: "coaching"` | `/calendar` exists | `COACHING_PROGRAM_SOURCE_MAP.md` §05_Dashboard_Specs |
| Compliance / Marketing review queues | Defer — single-team review handled by Jeremy directly | n/a | `09_Role_Access_Model/`, `10_Compliance_Review/` |

## 5. AI assistant grounding sources (for `/atlas` adaptation)

See `LEGENDS_AI_ASSISTANT_HUB_ADAPTATION_PLAN.md` for the full plan. Quick reference:

| Legends assistant | Adapted from | Grounding source (root) |
|---|---|---|
| Legends Coach Assistant (default) | General LO Development Platform Assistant | `LF_Coaching_Platform_Artifacts/06_AI_Assistant_Knowledge/Coaching_Platform_Knowledge_Base.md`, `Role_Access_Knowledge.md`, `Tracker_Field_Dictionary.md` |
| Legends LO Support Assistant | LO Support Assistant | `2026-05-19_Loan_Factory_LO_Support_Automation_Action_Plan.md`, `Coach_Operations_Knowledge.md`, `Compliance_and_Risk_Knowledge.md` |
| Legends Marketing Assistant | Marketing Support Assistant | `Loan Factory — Marketing Strategy & AI Operations`, `28 Days / 40 Days Social Media Templates`, `10_Compliance_Review/Marketing_Content_Review_SOP.md` |
| Legends Prompt Library | Prompt Library Assistant | `src/data/prompts.ts` (source repo), `07_AI_Prompts/` (12 system prompts) |

**Constraint:** No live model calls are wired by this discovery pass. AI surfaces remain catalog-only in LegendsOS until `ALLOW_PAID_TEXT_GENERATION=true` and `OPENROUTER_API_KEY` are set by Jeremy.

## 6. Data file translation pattern

When adapting source data files (`src/data/*.ts` in the LF repo) into LegendsOS, follow this rename and reframe pattern:

| LF source file | Legends target | Action |
|---|---|---|
| `src/data/apex.ts` | drop entirely | LegendsOS has no paid tier model |
| `src/data/prompts.ts` | `lib/legends/prompts.ts` | Adapt to Legends voice; remove Loan-Factory-recruiting prompts; keep mortgage prompts |
| `src/data/modules.ts` | `lib/legends/curriculum.ts` | Re-author for Legends sales/marketing/AI tracks |
| `src/data/audioTraining.ts` | `lib/legends/audioLibrary.ts` | Cherry-pick Legends-relevant briefs |
| `src/data/videoTraining.ts` (planned) | `lib/legends/videoLibrary.ts` | Legends-only videos; HeyGen avatars reused if Jeremy approves |
| `src/data/handoutLibrary.ts` (planned) | `lib/legends/handoutLibrary.ts` | Legends-branded handouts only |

All Legends data files use **internal-only** flags by default. No borrower-facing or Realtor-facing exports without Jeremy's explicit approval per asset.

## 7. Asset storage policy

- Large media (MP4, M4A, PPTX, PDF > 5 MB) stays in Google Drive. Adapter code references Drive URLs via `lib/legends/driveLinks.ts` (new file).
- Small assets (SVG, PNG < 1 MB, brand marks) live in `public/assets/legends/`.
- Supabase Storage buckets (`shared_resources`, `knowledge`) host items that need RLS-gated team access.
- No `.env`, secrets, OAuth tokens, or borrower PII ever enter the repo.

## 8. Out-of-scope for the first sprint

- FaceGram / Legends Lounge
- Corporate Coach Hub (Legends only has Jeremy as coach today)
- Multi-tier role enforcement beyond `owner | admin | member`
- Public landing pages for any track (Legends Growth Academy is internal-only)
- Marketing review queue, compliance review queue (handled by Jeremy directly)
- Lender / vendor / AE social channels
- Audience Quality Panel and AI scoring rubric (defer to a second sprint)

## 9. Open questions for Jeremy

1. Confirm "Legends Growth Academy" as the user-facing module name vs. an alternative ("Legends Academy", "Legends Sales School", etc.).
2. Confirm Legends does not need FaceGram now (use Slack/Discord externally).
3. Confirm which of the 7 HeyGen avatar videos may be reused in LegendsOS (some are explicitly Loan-Factory-branded).
4. Confirm Legends does not need the paid-tier landing surfaces — internal tracks only.
5. Confirm role model: `owner | admin | member` (current LegendsOS) vs. needing `team_lead` and `coach` rows.

## 10. Production safety reminders

- This map authorizes no code changes by itself.
- All adaptations must be PR-reviewed by Jeremy before merging to `main`.
- No Netlify deploy is triggered by docs-only commits.
- No live AI calls, no n8n triggers, no email sends, no social publishes — all gated by `ALLOW_*` env flags that default to `false`.

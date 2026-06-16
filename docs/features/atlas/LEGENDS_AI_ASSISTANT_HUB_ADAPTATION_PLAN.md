# Legends AI Assistant Hub — Adaptation Plan

**Status:** Planning. Catalog-only until provider gate flipped by Jeremy.
**Date:** 2026-05-22
**Target:** LegendsOSv2.0 `/atlas`
**Source:** Loan Factory LO Development Platform AI Assistant Hub spec + `AI_ASSISTANT_KNOWLEDGE_MAP.md`

---

## 1. Where this lives in LegendsOS

LegendsOSv2.0 already ships `/atlas` as a Hermes-style AI assistant with:

- `atlas_assistants` table for assistant configuration
- `chat_threads` + `chat_messages` for conversation persistence
- `lib/ai/providers.ts` with OpenRouter, DeepSeek, NVIDIA chat + Fal.ai image
- `lib/atlas/intentDetection.ts` + `lib/atlas/toolRouter.ts` for tool routing
- Knowledge retrieval via `knowledge_collections` + `retrieval_references`
- Compliance line injected in every Atlas system prompt
- Safety gates: `ALLOW_PAID_TEXT_GENERATION` defaults to `false`

The Legends Assistant Hub **extends Atlas with three named assistants** plus a Prompt Library tool. It does not introduce a separate `/ai-assistants` route.

## 2. Three primary Legends assistants

| Slug | Display name | Section | Default scope |
|---|---|---|---|
| `legends-coach` | Legends Coach | core | General Q&A across the platform — training, calendar, settings, "where do I find X" |
| `legends-lo-support` | Legends LO Support | core | Lender placement routing, escalation, post-onboarding |
| `legends-marketing` | Legends Marketing | studios | Marketing copy drafts (social, recruiting, partner outreach) — all draft-only |

Each is a row in `atlas_assistants`. Seed via `scripts/seed-atlas-assistants-from-local.ts`.

A fourth surface — the **Prompt Library** — is a knowledge collection + Atlas tool, not a separate assistant.

## 3. System prompt sources (adapted)

System prompts are **adapted, not copied**. Source documents inform structure and rules; Legends voice rewrites the final prompt.

### 3.1 Legends Coach (`legends-coach`)

Adapted from: General LO Development Platform Assistant.

Sources read (all from handoff package or its referenced paths):
- `LF_Coaching_Platform_Artifacts/06_AI_Assistant_Knowledge/Coaching_Platform_Knowledge_Base.md`
- `LF_Coaching_Platform_Artifacts/06_AI_Assistant_Knowledge/Role_Access_Knowledge.md`
- `LF_Coaching_Platform_Artifacts/06_AI_Assistant_Knowledge/Tracker_Field_Dictionary.md`
- Handoff `BUILD_CONTEXT.md`

Legends-specific overrides:
- Tone: "Senior coach for The Legends Mortgage Team." Calm, direct, no fluff.
- Refuses borrower-specific underwriting, rate/fee/APR claims, public marketing claims.
- Routes lender placement Qs to Legends LO Support; routes marketing Qs to Legends Marketing.
- Cites the source doc when answering "what is X."

### 3.2 Legends LO Support (`legends-lo-support`)

Adapted from: LO Support Assistant.

Sources:
- `2026-05-19_Loan_Factory_LO_Support_Automation_Action_Plan.md`
- `2026-05-19_LO_Feedback_Form_v1_Spec.md`
- `2026-05-19_Shared_LO_Record_and_Routing_Architecture_Note.md`
- `2026-05-19_Lender_Escalation_Compliance_SignOff_Memo.md`
- `LF_Coaching_Platform_Artifacts/06_AI_Assistant_Knowledge/Coach_Operations_Knowledge.md`
- `LF_Coaching_Platform_Artifacts/06_AI_Assistant_Knowledge/Compliance_and_Risk_Knowledge.md`

Hard rules (lifted from source):
- No auto-send on lender escalation. Drafts only.
- No anonymous identity exposure on LO feedback. PII redaction.
- No AI-generated outbound email body under Loan Factory NMLS in v1 — templates only.
- No outbound to lender AEs outside Mon–Fri 7am–7pm Eastern.
- Routes any compliance-sensitive Q to "draft, human review required."

### 3.3 Legends Marketing (`legends-marketing`)

Adapted from: Marketing Support Assistant.

Sources:
- `Loan Factory — Marketing Strategy & AI Operations` folder
- `28 Days Social Media Templates Legends`
- `40 Days Social Media Templates for Jeremy`
- `Today's Tip Do You Know Your Credit Score`
- `Paid Media Playbook for Real Estate, Mortgage, DSCR, and Fix and Flip Lending.pdf`
- `Weekly-Content-System.pdf`
- `LF_Coaching_Platform_Artifacts/10_Compliance_Review/Marketing_Content_Review_SOP.md`
- `LF_Coaching_Platform_Artifacts/10_Compliance_Review/Borrower_Facing_Content_Checklist.md`
- `LF_Coaching_Platform_Artifacts/10_Compliance_Review/Realtor_Partner_Content_Checklist.md`
- `LF_Coaching_Platform_Artifacts/10_Compliance_Review/Disclaimer_Library.md`
- `LF_Coaching_Platform_Artifacts/10_Compliance_Review/Production_Claim_Standards.md`

Hard rules:
- Rate / fee / APR / approval claims → refuses.
- "Free processing," "daily companywide training," "lowest rate," "guaranteed approval" → refuses.
- All output is **draft-only**. UI badge: "Draft — Jeremy review required" for borrower-facing copy.
- Auto-appends the Legends compliance footer to any externally-facing draft.

### 3.4 Prompt Library tool

Not a separate assistant. A knowledge collection (`legends_prompts`) loaded into `knowledge_items` plus an Atlas tool function that:
- Takes a user task description.
- Matches against the prompt catalog.
- Returns the top match + customization fields.
- Lets the user copy to clipboard, run inside Atlas, or open in Gemini.

Sources:
- `src/data/prompts.ts` (LF repo) — shape only, content rewritten for Legends.
- `LF_Coaching_Platform_Artifacts/07_AI_Prompts/` (12 system prompts) — adapted.
- `~/Desktop/JEREMY's MASTER BUILD FOLDER/Prompt guide for Claude.pdf` — reference.

## 4. Grounding: knowledge collection setup

Each assistant has a grounding collection in `knowledge_collections`:

| Collection slug | Owned by | Items |
|---|---|---|
| `legends-coach-grounding` | owner | Platform overview, role definitions, tracker dictionary, FAQ |
| `legends-lo-support-grounding` | owner | Lender escalation memo, LO feedback spec, support routing playbook |
| `legends-marketing-grounding` | owner | Disclaimer library, claim standards, Realtor checklist, social templates |
| `legends-prompts` | owner | Prompt catalog (~30 prompts to start) |

Items are uploaded via `scripts/import-local-knowledge.ts` (already exists in repo).

Per-assistant access wired via `assistant_knowledge_access`. Each assistant defaults to its own collection plus `legends-prompts` for the Prompt Library tool.

## 5. Three-phase wiring

### Phase 1 — Catalog only (this sprint)

- Seed three `atlas_assistants` rows.
- Seed `knowledge_collections` shells (empty items table).
- Add an "Assistants" picker chip in `/atlas` that switches between the three.
- Document each assistant's purpose in a card on `/atlas` (which assistant for what).
- **No live model calls** — `ALLOW_PAID_TEXT_GENERATION=false` returns the existing "live_action_blocked" response.

### Phase 2 — Grounding upload (this or next sprint, owner-driven)

- Owner runs `npm run import-local-knowledge` against the three grounding collections.
- Sources are uploaded as `knowledge_items` rows. Files routed to `knowledge` Supabase bucket.
- Atlas retrieval automatically surfaces them when the relevant assistant is active.
- Still catalog-only at the model layer.

### Phase 3 — Live model wiring (gated)

Prerequisites (owner-controlled):
- `OPENROUTER_API_KEY` set.
- `ALLOW_PAID_TEXT_GENERATION=true` in production env.
- Daily caps reviewed.

When the gate flips:
- `/api/ai/chat` returns real model output.
- Each assistant's system prompt is injected (loaded from `atlas_assistants.system_prompt`).
- Inline citations rendered as reference chips (already supported via `wonderful-blackburn` branch pattern).
- Tool router fires `legends-marketing` drafts into `email_campaigns` or `social_posts` based on intent (draft-only, never live publish).

## 6. UX integration

`/atlas` already has:
- Threads list
- Conversation view
- Attachment-only send
- Provider toggle
- Collapsible Projects + Resources panels

Adds for Legends Assistant Hub:
- **Assistant picker chip row** at the top of a new thread: `Legends Coach | LO Support | Marketing`.
- **Default thread title**: includes the assistant slug for clarity.
- **"Used Prompt Library" indicator** on messages where the Prompt Library tool fired.
- **"Draft — review required" badge** on messages from `legends-marketing` when output is externally-facing.

No new top-level routes are needed. The deeper "14-assistant catalog" from the LF spec is **deferred** — Legends doesn't need it yet.

## 7. Compliance posture

All three assistants share these floors:

- No final underwriting decisions.
- No rate / fee / APR / approval claims.
- No borrower PII in messages.
- No TERA writes.
- No public API claims about Loan Factory.
- Compliance line auto-injected in every system prompt.
- All output is logged in `usage_events` + `audit_logs`.
- Live publish/send is hard-gated by `ALLOW_LIVE_*` flags.

## 8. Files likely to change

```
scripts/seed-atlas-assistants-from-local.ts       ← extend seed data
scripts/import-local-knowledge.ts                  ← Legends grounding inputs
lib/atlas/intentDetection.ts                       ← add Legends-specific intents
lib/atlas/toolRouter.ts                            ← add Prompt Library tool
app/(app)/atlas/page.tsx                           ← assistant picker UI
app/(app)/atlas/[threadId]/page.tsx                ← assistant label, draft badge
components/atlas/AssistantPicker.tsx               ← NEW
components/atlas/ToolResultCard.tsx                ← extend
lib/legends/assistants.ts                          ← NEW (config)
lib/legends/prompts.ts                             ← NEW (catalog)
```

## 9. Open questions for Jeremy

1. Confirm Legends ships exactly three assistants (Coach / LO Support / Marketing) and a Prompt Library tool — no broader 14-assistant catalog.
2. Which model provider is the production choice (OpenRouter default vs DeepSeek vs NVIDIA)?
3. Daily caps per assistant (current `lib/usage.ts` is per-user; do we want per-assistant caps?).
4. Should the Marketing Assistant auto-flag drafts for owner review queue, or just label them and rely on the user?
5. Voice/tone guide: should each assistant share one Legends voice, or do they differentiate (Coach = direct, Marketing = creative, LO Support = precise)?

## 10. Out of scope

- Live model wiring (gated separately).
- AI Coaching Companion as a separate avatar/personality.
- HeyGen / video assistants.
- Multi-coach persona switching beyond the three primary assistants.
- Marketing review queue UI (Phase 4+).

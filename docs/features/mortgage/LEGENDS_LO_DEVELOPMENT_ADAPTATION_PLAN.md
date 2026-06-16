# Legends LO Development — Adaptation Plan

**Status:** Planning. Discovery pass complete; build is gated on Jeremy's review.
**Date:** 2026-05-22
**Target:** LegendsOSv2.0
**Source:** Loan Factory LO Development Platform (eight-module prototype) + handoff package
**Pairs with:** `LEGENDS_GROWTH_ACADEMY_SOURCE_MAP.md`, `LEGENDS_GROWTH_ACADEMY_ARCHITECTURE.md`, `LEGENDS_AI_ASSISTANT_HUB_ADAPTATION_PLAN.md`

---

## 1. What we are adapting

The Loan Factory LO Development Platform is an internal, eight-module training/coaching/AI/community surface for Loan Factory employees company-wide. LegendsOSv2.0 is the internal operating system for The Legends Mortgage Team only. We are not lifting LF's product wholesale — we are extracting the concepts and content shape that benefit a single-team OS and rebuilding them in Legends voice.

The umbrella inside LegendsOS for this work is **Legends Growth OS** with **Legends Growth Academy** as the training pillar. Other pillars (coach hub, team-lead OS, trackers, persona library) are sub-modules under the same umbrella.

## 2. Adaptation strategy: keep, reshape, drop

| LF module | Legends decision | Rationale |
|---|---|---|
| Elite Sales & Marketing 101–601 curriculum | **Keep + reshape** | Curriculum logic is universal. Voice/branding/examples rewritten for Legends. |
| LO Mastery Coaching (Level I, paid) | **Reshape, drop pricing** | Internal Legends "Mastery Track" with no paid tier. |
| Loan Factory Alliance (Level II, paid) | **Reshape, drop pricing** | Internal Legends "Elite Track" with no paid tier. |
| AI Assistant Hub | **Keep + simplify** | Three primary assistants live in Atlas; deeper assistant catalog deferred. |
| FaceGram | **Defer / drop** | Team is too small for an internal social product. Slack/Discord covers it. |
| Training Library | **Keep + reshape** | Catalog of recordings, scripts, roleplays, audio. Reuses `shared_resources` table. |
| Team Leader OS | **Reshape, single-leader scope** | Owner-only surface initially; expand if Legends grows. |
| Corporate Coach Hub | **Defer** | Legends has one coach (Jeremy). No multi-coach surface needed yet. |

## 3. Phased plan (target: LegendsOSv2.0 `main` via feature branches)

### Phase 0 — Discovery and docs (this pass)

- ✅ Locate LegendsOSv2.0 local
- ✅ Read all 15 handoff package maps
- ✅ Map source → target
- ✅ Write architecture doc
- ✅ Write light mode plan
- ✅ Write AI assistant adaptation plan
- ✅ Write persona system plan
- ✅ Write next-sprint plan
- ⏳ Jeremy reviews and approves build kick-off

### Phase 1 — Academy scaffold (estimated 1 build sprint)

**Acceptance:** `/training/academy` renders. Three sub-routes scaffolded (sales, marketing, ai). Lint/typecheck/build/playwright all green.

Tasks:
1. Repurpose `/training` page as Academy landing with sub-cards.
2. Create `/training/academy/page.tsx`, `/training/academy/[track]/page.tsx`, `/training/academy/[track]/[module]/page.tsx`.
3. Create `lib/legends/curriculum.ts` with 101–601 sales modules + a marketing track skeleton + an AI track skeleton, all rewritten in Legends voice.
4. Extend `lib/teamResources.ts` with academy-aware resource types.
5. Add nav rows for Academy, Scripts Library, Roleplay Lab.
6. Smoke test: unauthenticated → `/login`; authenticated → Academy landing renders.

Files touched: ~10. No deletions. All additive.

### Phase 2 — Trackers + progress (estimated 1 sprint)

**Acceptance:** Members can submit a weekly activity tracker and see their own progress on `/dashboard`. Owner sees aggregated team view.

Tasks:
1. New migration adding `legends_trackers`, `legends_tracker_submissions`, `legends_module_progress`.
2. RLS policies mirroring existing pattern (per-user select on own; owner select on all).
3. Build `/training/academy/[track]/[module]/page.tsx` progress UI (started, % complete, completed).
4. Build `/dashboard` "Your Academy" card (last module, next module, % complete).
5. Build `/admin/users/[userId]` "Academy progress" panel for owner view.

Files touched: ~14. Includes one new migration.

### Phase 3 — Scripts + Roleplay Lab (estimated 1 sprint)

**Acceptance:** Scripts Library renders with seed scripts. Roleplay Lab opens a guided practice session in Atlas with a persona prompt.

Tasks:
1. Build `/training/scripts/page.tsx` and `/training/scripts/[scriptId]/page.tsx`.
2. Seed `shared_resources` with `resource_type: 'legends_script'` rows. Scripts cover prospecting, first-call, follow-up, referral partner, recapture, listing agent, buyer's agent.
3. Build `/training/roleplay/page.tsx` listing personas + scenarios.
4. Wire Roleplay → Atlas: click a scenario → open new Atlas thread with that persona's system prompt.
5. Add a roleplay-specific Atlas assistant row that loads the selected persona.

### Phase 4 — Team Lead OS + Coaching Calendar (estimated 1 sprint)

**Acceptance:** Owner sees `/training/team-lead-os` with team scorecard, recruiting tracker, recognition log. `/calendar` adds a "Coaching" filter chip.

Tasks:
1. Build `/training/team-lead-os/page.tsx` owner-only.
2. Wire team scorecard data from `legends_tracker_submissions` rollups.
3. Add `category: 'coaching'` to calendar items and a filter chip.
4. Seed coaching cadence: weekly 1:1, monthly scorecard review, quarterly business review.

### Phase 5 — Live AI assistant wiring (gated by provider sign-off)

**Acceptance:** Atlas chat returns real model output for `legends-coach`, `legends-lo-support`, `legends-marketing`. Each cites sources and refuses out-of-scope.

Prerequisites (Jeremy controls):
- `OPENROUTER_API_KEY` set in production env.
- `ALLOW_PAID_TEXT_GENERATION=true`.
- Grounding packs loaded into Supabase knowledge tables.

Tasks: see `LEGENDS_AI_ASSISTANT_HUB_ADAPTATION_PLAN.md` Phase 3.

## 4. Branding rules during adaptation

These rules apply to every string that ships into LegendsOS as part of this work.

- Always say "**The Legends Mortgage Team**" or "**Legends**" as the team name. Never "Loan Factory LO Development Platform" inside LegendsOS surfaces.
- "**Powered by Loan Factory**" is the footer attribution where appropriate.
- Use "**LO**" or "**loan officer**", never ELO.
- Use "**TERA**", never MOSO.
- Drop "Apex Advisor" entirely from new Legends copy. (LF still has legacy `/apex-*` routes — those live in the LF repo, not here.)
- No "free processing," "lowest rate," "guaranteed approval," "daily companywide training."
- No claim that Loan Factory has a public API.
- No rate / fee / APR numbers in any AI output or static copy.
- Compliance footer for any marketing draft generated by Legends:

```
Jeremy McDonald | (904) 442.3213 | The Legends Mortgage Team powered by Loan Factory
NMLS 1195266 | Loan Factory NMLS 320841
Equal Housing Opportunity
Not a commitment to lend. All loans subject to credit approval and program guidelines.
```

## 5. Data adaptation guardrails

- Source `.ts` data files are read for shape only. Content is rewritten in Legends voice.
- Source PDF/DOCX/MD assets in the handoff package are reference-only. Direct copy only with explicit per-asset approval from Jeremy.
- HeyGen avatar videos: Loan-Factory-branded videos do **not** ship to LegendsOS. Legends-branded HeyGen renders (or Jeremy's personal HeyGen avatar) are acceptable per Jeremy's approval.
- All Drive-hosted assets continue to live in Drive; LegendsOS holds references only.
- Borrower PII, lender NDAs, internal Loan Factory financials — **not** in scope, not copied, not referenced.

## 6. Safety / production rules

This adaptation is **local-development** until Jeremy approves merge + deploy.

- No `git push` from this discovery pass.
- No Netlify deploy.
- No `.env` edits, no secret exposure.
- No live AI calls (catalog-only until provider gate flipped).
- No n8n triggers.
- No social publishes, no email sends, no calendar invites.
- No database writes against the live Supabase project.
- The old `Legends-MTG-Support-Pro` repo is **legacy**. Do not migrate from it, do not delete it.

When the build sprint kicks off:
- Work on a feature branch (`feat/legends-growth-academy-phase-1`).
- Open a PR for Jeremy to review.
- Do not auto-merge.
- Do not push to `main` without explicit approval per PR.

## 7. Open decisions for Jeremy before build

1. **Module name:** "Legends Growth Academy" vs "Legends Academy" vs "Legends Sales School" — pick one.
2. **Track naming:** Sales / Marketing / AI / Mastery vs alternative groupings.
3. **HeyGen reuse:** which Loan Factory HeyGen videos (if any) can be reused with a Legends voice-over swap.
4. **Trackers cadence:** weekly / biweekly / monthly defaults.
5. **Recognition log:** how Legends defines milestones (units, volume, certifications, behaviors).
6. **Scripts Library scope:** Legends-only scripts vs adapting the full LF script catalog.
7. **Roleplay personas:** mortgage-specific personas (first-time buyer, jumbo buyer, FHA, VA, DSCR, refi, Realtor partner, recapture target) vs broader sales personas.
8. **Audio Library:** which of Jeremy's 28-day / 40-day social audio packs ship inside LegendsOS.

## 8. Deliverables when Phase 1 ships

- `/training/academy` route live.
- Three sub-tracks (sales, marketing, ai) scaffolded with at least 3 modules each.
- Academy nav row visible in sidebar under "Team".
- `lib/legends/curriculum.ts` populated with Legends-authored module summaries.
- Lint, typecheck, build, e2e smoke all green.
- `docs/STATUS.md` updated with the sprint summary.
- Playwright authenticated smoke run captured.

## 9. References

- `LEGENDS_GROWTH_ACADEMY_SOURCE_MAP.md` — source-to-target table.
- `LEGENDS_GROWTH_ACADEMY_ARCHITECTURE.md` — routes, components, data model.
- `LEGENDS_AI_ASSISTANT_HUB_ADAPTATION_PLAN.md` — Legends assistants.
- `LEGENDS_TEAM_PERSONA_SYSTEM_PLAN.md` — persona library + roleplay personas.
- `LEGENDS_LIGHT_MODE_IMPLEMENTATION_PLAN.md` — light mode rollout.
- `LEGENDS_NEXT_LOCAL_BUILD_SPRINT.md` — concrete first-sprint task list.
- `_staging/lo-development-codex-handoff-review/lo-development-codex-handoff/` — the source handoff package.

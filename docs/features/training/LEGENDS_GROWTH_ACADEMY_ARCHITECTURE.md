# Legends Growth Academy — Architecture

**Status:** Planning. No code authorized to ship from this doc yet.
**Date:** 2026-05-22
**Target:** LegendsOSv2.0 (`legendsos-v2` repo, `main` branch)
**Pairs with:** `LEGENDS_GROWTH_ACADEMY_SOURCE_MAP.md`, `LEGENDS_LO_DEVELOPMENT_ADAPTATION_PLAN.md`

---

## 1. Where it fits in LegendsOS

Legends Growth Academy is a **module group** under the existing `(app)` protected layout — not a separate app. It reuses the LegendsOS shell, auth, RLS, AI gateway, automation layer, and theme system.

```
app/(app)/                       ← existing protected shell
├── dashboard/                   ← Command Center (existing)
├── atlas/                       ← AI Assistant Hub (extend with Legends assistants)
├── knowledge/                   ← Source Knowledge (extend with personas, prompts)
├── training/                    ← Legends Growth Academy LANDS HERE
│   ├── page.tsx                 ← existing — becomes Academy landing
│   ├── [resourceId]/            ← existing detail route
│   ├── academy/                 ← NEW — track pages
│   │   ├── page.tsx             ← academy index
│   │   ├── sales/[module]/      ← 101-601 sales curriculum
│   │   ├── marketing/[module]/  ← marketing track
│   │   ├── ai/[module]/         ← AI training track
│   │   └── mastery/[module]/    ← Legends Mastery / Elite tracks
│   ├── roleplay/                ← NEW — Roleplay Lab
│   ├── scripts/                 ← NEW — Scripts Library
│   ├── audio/                   ← NEW — Audio Library
│   └── team-lead-os/            ← NEW — Team Lead OS (owner-gated for now)
├── shared/                      ← Shared Resources (existing)
├── social/                      ← Social Studio (existing — NOT FaceGram)
├── images/                      ← Image Studio (existing)
├── email/                       ← Email Studio (existing)
├── calendar/                    ← Calendar + Coaching Calendar (existing)
├── marketing-materials/         ← Marketing assets (existing)
├── lf-resources/                ← Loan Factory resource directory (existing)
├── admin/                       ← Admin Center (existing)
└── settings/                    ← Settings (existing)
```

## 2. Navigation surfaces

`lib/navigation.ts` already groups routes into `core | studios | team | owner`. Legends Growth Academy lives in the **team** section.

Proposed nav additions (Phase 1):

```ts
{
  section: "team",
  href: "/training/academy",
  label: "Legends Academy",
  description: "Sales · Marketing · AI · Mastery tracks",
  icon: GraduationCap,
},
{
  section: "team",
  href: "/training/scripts",
  label: "Scripts Library",
  description: "Mortgage scripts and templates",
  icon: BookOpen,
},
{
  section: "team",
  href: "/training/roleplay",
  label: "Roleplay Lab",
  description: "AI-assisted practice scenarios",
  icon: MessageCircle,
},
```

The existing `/training` page becomes the **Academy landing** with sub-cards for each child route.

## 3. Data model additions

LegendsOS already has 19 tables (see `docs/ARCHITECTURE.md`). Adding Legends Growth Academy needs a small number of new tables plus reuse of existing ones.

### Reuse (no schema changes)

| Table | Used for |
|---|---|
| `shared_resources` | Training items, scripts, handouts, roleplay scenarios — all flagged via `resource_type` |
| `knowledge_collections` + `knowledge_items` | Persona library, prompt library, source-grounded knowledge packs |
| `atlas_assistants` | Three new Legends assistants registered as rows |
| `chat_threads` + `chat_messages` | Existing Atlas conversation storage |
| `calendar_items` | Coaching sessions, training meetings — flag via `category` |
| `audit_logs` + `usage_events` | All Academy actions logged through existing pattern |

### New tables (Phase 2+)

| Table | Purpose | Required by phase |
|---|---|---|
| `legends_curriculum_modules` | 101–601 sales, marketing, AI, mastery curriculum entries | Phase 2 |
| `legends_module_progress` | Per-user progress through modules (started, % complete, last_seen, completed_at) | Phase 2 |
| `legends_trackers` | Form spec rows: Activity, Scorecard, 90-Day Ramp, QBR, Recognition, Recruiting | Phase 3 |
| `legends_tracker_submissions` | Per-user tracker submissions, RLS-gated | Phase 3 |
| `legends_roleplay_scenarios` | Roleplay prompt + persona pairs | Phase 3 |
| `legends_certifications` | Certification log | Phase 4 |

All new tables follow the existing RLS pattern: per-user select on own rows, owner/admin select on all, no client write to system rows.

## 4. AI assistant model

Legends Growth Academy ships **three primary assistants** + a Prompt Library tool inside Atlas:

| Assistant slug | Display name | Default scope | System prompt source (adapted) |
|---|---|---|---|
| `legends-coach` | Legends Coach | General platform Q&A, training routing | `Coaching_Platform_Knowledge_Base.md` |
| `legends-lo-support` | Legends LO Support | Lender placement, escalations, post-onboarding | `2026-05-19_Loan_Factory_LO_Support_Automation_Action_Plan.md` |
| `legends-marketing` | Legends Marketing | Marketing copy drafts, social, recruiting | `Marketing_Content_Review_SOP.md` + `28/40 Days Social Media Templates` |

Each is seeded into `atlas_assistants` via `scripts/seed-atlas-assistants-from-local.ts`. Default assistant for `/atlas` is `legends-coach`.

Hard rules per assistant:
- **No rate / fee / APR / approval / underwriting language.**
- **Marketing Assistant external output is draft-only** with a "review required" badge.
- **LO Support Assistant does not auto-send lender escalations** — drafts only.
- **Provider secrets never reach the browser.** Provider gated on `ALLOW_PAID_TEXT_GENERATION`.

## 5. Theme integration

Legends Growth Academy uses the existing LegendsOS theme tokens (ink + accent gold/champagne). No new color tokens are introduced. Light mode (see `LEGENDS_LIGHT_MODE_IMPLEMENTATION_PLAN.md`) applies automatically once that plan ships.

Component-level reuse:
- `card`, `card-padded`, `btn-primary/secondary/ghost`, `chip*` classes from `globals.css`
- `SectionHeader`, `StatCard`, `StatusPill`, `EmptyState` from `components/ui`
- No new design system primitives are needed for Phase 1.

## 6. Permissions and access

Single role model (`owner | admin | member` from current LegendsOS) is sufficient for the first sprint. The expanded role grid from the LF Coaching Platform (12 roles) is **not** ported — Legends is a small team and the role gradient is much flatter.

Per-surface gates:

| Surface | Visible to |
|---|---|
| `/training/academy/**` | all members |
| `/training/scripts` | all members |
| `/training/roleplay` | all members |
| `/training/audio` | all members |
| `/training/team-lead-os` | owner + admin only |
| `/admin/**` | owner only (already enforced) |

Future expansion: add `team_lead` role if Legends grows past ~5 LOs; mirror the matrix in `ROLE_ACCESS_MAP.md` then.

## 7. Routing and URL conventions

- Internal-only. No public marketing pages. `robots: { index: false, follow: false }` already set in root layout.
- All Academy routes are nested under `/training/*` to keep the nav tree shallow.
- Detail routes use slug params (`[resourceId]`, `[module]`) backed by `shared_resources` rows or `legends_curriculum_modules` rows.

## 8. Files likely to change in Phase 1 build

```
app/(app)/training/page.tsx                          ← repurpose as Academy landing
app/(app)/training/academy/page.tsx                  ← NEW
app/(app)/training/academy/[track]/page.tsx          ← NEW
app/(app)/training/academy/[track]/[module]/page.tsx ← NEW
lib/navigation.ts                                    ← add 2-3 nav rows
lib/legends/curriculum.ts                            ← NEW (data)
lib/legends/audioLibrary.ts                          ← NEW (data)
lib/teamResources.ts                                 ← extend with academy categories
components/training/AcademyTrackCard.tsx             ← NEW
components/training/ModuleProgressPill.tsx           ← NEW
docs/STATUS.md                                       ← log the sprint
```

All adaptations are additive. No deletions of existing files in Phase 1.

## 9. Verification plan

Per LegendsOS standard:

```bash
npm run lint
npm run typecheck
npm run build
npm run test:e2e   # extend smoke.spec.ts to cover /training/academy
```

Add a Playwright smoke check that the unauthenticated user is redirected from `/training/academy` to `/login`, and that an authenticated member sees the academy landing.

## 10. Constraints carried forward

- Static export-friendly. No new server-only data fetching that breaks the existing build.
- Tailwind 3.4. No Tailwind v4-only syntax.
- No new top-level dependencies for Phase 1. Reuse `lucide-react`, `date-fns`, `clsx`, `tailwind-merge`.
- Electron desktop wrapper continues to work because all routes are inside the same Next.js app.

## 11. Out of scope for Phase 1

- FaceGram / Legends Lounge.
- Live AI provider wiring (catalog-only assistants until provider gate flipped).
- Multi-coach Corporate Coach Hub.
- Public marketing or recruiting pages.
- Member billing / subscription tiers (Legends is internal-only).
- Audience Quality Panel scoring rubric.

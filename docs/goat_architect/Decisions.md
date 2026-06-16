# LegendsOS — Architecture Decisions

## ADR-001: Two chat backends (Atlas vs Agent Runtime)

**Decision:** Keep both for now; consolidate in a future sprint.

**Context:** Atlas (`/api/ai/chat`) is a ~995 LOC monolith with loan-memory
retrieval, tool routing, and project context. The agent runtime
(`/api/agents/chat` + `lib/agents/runtime.ts`) is a parameterized orchestrator
for FLO, Marketing Assistant, and Coordinator. Both call the same AI gateway.

**Rationale:** Merging requires re-expressing Atlas as an agent type and
migrating `chat_threads`/`chat_messages` to `agent_sessions`/`agent_messages`.
The risk of breaking Atlas's tool ecosystem mid-sprint is high. Defer until a
dedicated sprint.

**Status:** Open — recommended as the next major architectural simplification.

---

## ADR-002: Sidebar consolidation (38 → 19 items)

**Decision:** Reduce sidebar to one entry per destination. Sub-pages become
tabs via AdminNav, SettingsNav, and AcademyNav components.

**Context:** Users faced a 38-item sidebar that required scrolling and
scanning. Admin alone had 10 entries; Settings had 3; Training had 4.

**Rationale:** Every page stays reachable at its URL. The sidebar becomes a
scannable ~12-item map for regular team members. Sub-navigation rail
components (already proven with AcademyNav) handle the depth.

**Status:** Implemented (2026-06-15).

---

## ADR-003: Stub integrations gated as "Coming Soon"

**Decision:** Show "Coming Soon" badges on integration connect buttons that
have no backend OAuth implementation.

**Context:** Zapier, Meta, Google OAuth, Google Drive, Telegram, HeyGen,
YouTube, and Google Business Profile all had UI "Connect" buttons that failed
silently or errored.

**Rationale:** The app should never advertise a button that doesn't work. When
OAuth is configured in the future, the buttons automatically activate.

**Status:** Implemented (2026-06-15).

---

## ADR-004: GOAT API fenced but not separated

**Decision:** Keep GOAT API in the same deployment but clearly document it as
an external API not used by the LegendsOS UI.

**Context:** 14 GOAT endpoints + ~979 LOC of lib code live alongside the team
app, adding mental overhead for developers.

**Rationale:** Separate deployment adds operational complexity. A README
boundary + clear naming is sufficient until the API grows enough to justify its
own service.

**Status:** Implemented (2026-06-15).

---

## ADR-005: AI Chief of Staff is a read-only layer over existing data

**Decision:** Build the AI Chief of Staff (`/chief-of-staff`) as a thin,
read-only intelligence layer using simple rules over existing tables — not a
new CRM, not a new schema, not an AI/agent pipeline.

**Context:** The first "intelligence product" goal was to answer "what matters
today?" The temptation is to build a contact database, an activity tracker, and
an LLM ranking pipeline. That would be a multi-month CRM build.

**Rationale:** A dumb, testable v1 ships now and proves the concept on real
data. It reads `loans`, `marketing_contacts`, `lead_intake_events`, and
`automation_jobs` through RLS-scoped queries, applies transparent time/status
rules, and renders prioritized cards. Each card states the exact signal it used.
No new tables were added. Every section is independently fault-tolerant, so
missing data degrades to an honest empty state. v2 can add an activity ledger,
dismiss/snooze, and light scoring once v1 earns its keep.

**Status:** Implemented (2026-06-16). See `AI_CHIEF_OF_STAFF_V1.md`.

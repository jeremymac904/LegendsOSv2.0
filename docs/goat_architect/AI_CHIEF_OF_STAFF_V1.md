# AI Chief of Staff — v1

**Status:** Shipped (v1)
**Route:** `/chief-of-staff`
**Surfaced from:** Sidebar → Core → "Chief of Staff" (first item)
**Date:** 2026-06-16

---

## What it does

The AI Chief of Staff answers one question when Jeremy opens LegendsOS:

> **"What matters today?"**

It is a thin, **read-only** intelligence layer over data the platform already
stores. It is **not** a CRM, **not** a loan origination system, and it does
**not** add automation or agent orchestration. It reads existing tables, applies
simple transparent rules, and produces a prioritized daily briefing of
recommendation cards across five sections:

1. **People to Contact** — non-partner contacts that have gone quiet
2. **Loans Needing Attention** — active files that are blocked, urgent, or stale
3. **Agent Relationships Cooling Off** — referral/realtor/provider partners with no recent activity
4. **Opportunities** — new, unreviewed, or high-priority leads
5. **Broken or Stale Automations** — automation jobs that failed or stalled

Each recommendation card shows:

- **Title** — who/what
- **Why it matters** — one sentence of context
- **Suggested next action** — the single thing to do
- **Source signal** — the exact rule that triggered it (honesty contract)
- **Confidence** — Low / Medium / High
- **Link** — deep-link to the relevant existing page when one exists

---

## Data sources used

All reads go through `getSupabaseServerClient()` and are **RLS-scoped** — each
person sees only their own picture. No service-role escalation, no cross-user
data.

| Section | Table(s) | Key columns / signals |
|---|---|---|
| People to Contact | `marketing_contacts` | `updated_at` (quiet > 30/60/90d), excludes partner types |
| Loans Needing Attention | `loans` (+ `borrowers`) | `stage_status='blocked'`, `priority` high/urgent, `updated_at` stale ≥ 7/14d |
| Agent Relationships Cooling | `marketing_contacts` | `contact_type IN (realtor_partner, provider_partner, referral_partner)` + `updated_at` quiet |
| Opportunities | `lead_intake_events` | `status IN (new, needs_review, qualified)`, `priority` high/urgent, aging |
| Broken Automations | `automation_jobs` | `status='failed'`, or `status IN (queued, sent)` stalled ≥ 1h |

Every section is queried **independently and fault-tolerantly**: a missing
table, a missing column, or an RLS-empty read degrades to a useful empty state.
One broken source can never break the page.

---

## Recommendation rules (v1)

Deliberately simple heuristics — no AI, no ML, no scoring models.

**People to Contact**
- Quiet ≥ 90 days → High · ≥ 60 → Medium · ≥ 30 → Low
- Partner contact types are excluded (they belong to the cooling section)

**Loans Needing Attention** (active stages only; closed/funded/withdrawn/past_client excluded)
- `stage_status = 'blocked'` → High
- `priority = 'urgent'` → High · `priority = 'high'` → Medium
- `updated_at` ≥ 14 days → High · ≥ 7 days → Medium

**Agent Relationships Cooling Off**
- Partner quiet ≥ 60 days → High · ≥ 45 → Medium · ≥ 30 → Low

**Opportunities** (open statuses only)
- `priority = 'urgent'` → High
- `status IN (new, needs_review)` → Medium
- `priority = 'high'` → Medium
- Open ≥ 30 days → Low

**Broken or Stale Automations**
- `status = 'failed'` → High (shows the error)
- `status IN (queued, sent)` and not advanced ≥ 1h → Medium (stalled)

Within each section, items are ranked by an internal weight (signal strength +
recency) and trimmed to the 6 most important.

---

## Known limits (v1)

- **Heuristics, not intelligence.** Rules are time/status thresholds. No
  semantic understanding of the relationship or deal.
- **Cooling partners** are inferred only from `marketing_contacts.updated_at`.
  There is no per-partner activity ledger yet, so a partner you contacted
  outside LegendsOS may still show as cooling.
- **Per-section cap of 6.** Long lists are trimmed; the count chip shows how
  many matched before display, but the full list isn't paginated.
- **No dismiss / snooze.** Cards can't yet be acknowledged or hidden; the
  briefing is recomputed fresh on every load.
- **RLS-scoped only.** A loan officer sees their loans; the owner sees the org.
  There is no cross-team roll-up view.
- **Empty/unavailable is honest.** If a table isn't populated or migrated, the
  section says so plainly rather than inventing items.

---

## How Jeremy should test it

1. Open LegendsOS → click **Chief of Staff** (top of the sidebar, Core section),
   or go to `/chief-of-staff`.
2. You should see five sections with a "What matters today" header and a count
   of items needing attention.
3. If your data is sparse, you'll see honest empty states ("All automations look
   healthy", "No active loans look blocked or stale") — this is correct, not a
   bug.
4. For any card, read the **Source signal** line — it states the exact rule that
   triggered it. Click the link (e.g. "Open My Loans", "Open automation panel")
   to jump to the existing page.
5. To exercise rules with real data: mark a loan's `stage_status` as `blocked`
   or its `priority` as `urgent`; let an `automation_jobs` row fail; add a
   `lead_intake_events` row with status `new`. Reload — they should surface.
6. Hit the JSON API directly (read-only): `GET /api/chief-of-staff` returns the
   same briefing payload.

Nothing on this page sends, publishes, writes, or deletes anything.

---

## What v2 should do

- **Activity ledger for partners** — track real touches (emails, calls, referrals
  received) so "cooling" reflects true engagement, not just row age.
- **Dismiss / snooze / done** — let Jeremy clear a card or defer it, persisted
  per user.
- **Loan task + condition signals** — fold `loan_tasks` (overdue/blocked) and
  `loan_conditions` (open/stalled) into "Loans Needing Attention" for richer
  detection.
- **One-click actions** — "Draft outreach in Atlas", "Re-run job", "Open lead"
  inline, instead of just deep-links.
- **Daily digest** — optional morning summary (in-app or email) of the top 3
  items, gated behind the existing `ALLOW_LIVE_EMAIL_SEND` safety flag.
- **Light scoring** — replace fixed thresholds with a small, explainable score
  that blends recency, value, and stage — still transparent, still rule-based.
- **Trend awareness** — "3 partners went cold this week" type deltas.

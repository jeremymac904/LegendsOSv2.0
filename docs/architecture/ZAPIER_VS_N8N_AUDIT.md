# Automation Routing Audit — Zapier MCP vs n8n vs HeroPost vs Direct APIs

**Sprint 3, Lane E (internal product audit, issue #7).**
**Scope:** social publishing + team workflow routing for LegendsOS v2.
**Status of this doc:** decision-useful comparison + recommendation. **Nothing is being activated.** Live sends stay OFF until Jeremy explicitly approves.
**Date:** 2026-05-31.

---

## 0. TL;DR

- **Recommendation: n8n stays the routing spine; direct Meta Graph API is the eventual publish path for Facebook/Instagram; Zapier MCP stays a stub (do not build it out now); HeroPost is NOT recommended as core infra.**
- The repo already commits to n8n: there is a real dispatcher (`enqueueAutomationJob`), a real inbound callback that is **HMAC-gated and fails closed**, a documented webhook contract, and a status helper. Zapier MCP is a deliberate `not_configured` stub. Meta is a disabled-by-default detector with a `publishStub` that never calls Meta.
- **Everything is safe-by-default today.** No path sends anything: dispatch defaults to `false`, `ALLOW_LIVE_SOCIAL_PUBLISH` / `ALLOW_LIVE_EMAIL_SEND` default to `false`, and no webhook URLs are wired. The only way a live send happens is owner action across multiple gates.
- **Do not activate anything in this sprint.** The phased rollout below keeps live sends off until each gate is individually, explicitly flipped by the owner.

---

## 1. What is already half-built in the repo (ground truth)

This is what the code actually does today — not aspirational. Verified by reading the files.

### n8n — the most-built path
- `lib/automation/n8n.ts`
  - `enqueueAutomationJob()` inserts an `automation_jobs` row and **only POSTs to n8n when the caller passes `dispatch: true` AND a webhook URL is configured.** Default is queue-only.
  - `getN8nConfigState()` returns booleans only (`configured`, `base_url_present`, per-webhook presence) — never a URL or secret. `configured` requires a base URL **and** at least one webhook.
  - `getWebhookUrl()` returns `null` (not a fake URL) when unconfigured — callers treat that as "queue, don't dispatch."
  - **Inbound callback is now HMAC-gated.** `verifyN8nSignature()` does a constant-time HMAC-SHA256 compare keyed by `N8N_WEBHOOK_SECRET` and **fails closed** (rejects when no secret, no signature, or mismatch). `isN8nCallbackSecretConfigured()` exposes presence only.
- `app/api/automation/callback/route.ts`
  - Rejects with `401` unless the `x-legendsos-signature` HMAC is valid. Only then does it update `automation_jobs` and propagate status to `social_posts` / `email_campaigns`.
  - **This is purely a status sink. It dispatches nothing.** A valid callback can flip a job to succeeded/failed; it cannot cause a send.

> **Doc drift flagged:** `docs/AUTOMATION.md` (lines 3-7) says HMAC signing and `N8N_WEBHOOK_SECRET` "have been removed" and that the only trust boundary is the job UUID. **That is stale.** The current callback route + `verifyN8nSignature()` *require* a valid HMAC and fail closed. The outbound dispatch in `enqueueAutomationJob()` does not HMAC-sign its POST body (it sends `x-legendsos-job-id` only), so the asymmetry is: **inbound is signed/verified, outbound is not.** AUTOMATION.md should be corrected in a future docs pass (out of scope for this lane's allow-list, which is this file only).

### Zapier MCP — intentional stub
- `lib/automation/zapier-mcp.ts`: `triggerZap()` and `getZapStatus()` always return `not_configured`. `isZapierMcpConfigured()` checks presence of `ZAP_MCP_KEY` / `ZAPIER_MCP_KEY`. **No Zapier call is implemented.** Honest "coming soon" copy.

### Meta (Facebook/Instagram) — disabled-by-default detector
- `lib/integrations/meta.ts`: `detectMetaConfig()` reports `configured` (needs `META_APP_ID` + `META_ACCESS_TOKEN` + a page or IG id) and `paid_enabled` (`configured && ALLOW_LIVE_SOCIAL_PUBLISH`). `publishStub()` **never calls Meta** — it returns `not_configured`, `paid_enabled_false`, or `not_implemented_yet` with a presence-only "would_have_sent" summary. Zero outbound calls.

### HeroPost — NOT in the repo
- `HeroPost` appears **nowhere** in the codebase. It is an external SaaS social-scheduling product being evaluated here, not anything half-built. Treat it as a buy-vs-build candidate, not existing infra.

### Webhook contract + env surface
- `n8n-required-webhooks.md` documents the env vars (`N8N_WEBHOOK_BASE_URL`, `N8N_WEBHOOK_SECRET`, per-channel webhook paths). All optional; empty = record intent, no outbound call.
- Live-send master switches: `ALLOW_LIVE_SOCIAL_PUBLISH`, `ALLOW_LIVE_EMAIL_SEND` (both default `false`, read in `lib/env.ts`).

**Net:** the repo has already *chosen* n8n + direct-Meta-later, with Zapier as an unbuilt escape hatch. This audit confirms that choice and explains why.

---

## 2. The four options

| Option | What it is | Role it would play here |
|---|---|---|
| **n8n** | Self-hostable (or n8n Cloud) workflow engine. Visual nodes + code nodes. Already wired as the LegendsOS routing spine. | Orchestration layer: receive a job webhook, fan out to channels, post status back to `/api/automation/callback`. |
| **Zapier MCP** | Zapier's MCP endpoint exposing thousands of Zap actions to an AI agent / app via a key. Currently a stub here. | Optional convenience bridge for actions we don't want to build (e.g. niche connectors), called from server code. |
| **HeroPost** | External social-media scheduling SaaS (Facebook/IG/LinkedIn/etc. queueing + analytics). | Buy-vs-build alternative to operating our own publisher. Would own OAuth + scheduling for social. |
| **Direct platform APIs** | Calling Meta Graph API, Google Business Profile API, YouTube Data API, Gmail API, Google Drive API ourselves. | Maximum control; we own OAuth, tokens, retries, rate limits. The Meta stub is already shaped for this. |

---

## 3. Comparison matrix

Scores are relative, for *this team* (14 mortgage staff, non-technical LOs, owner = Jeremy). H = high/good where higher is better; for risk columns, lower is better.

| Criterion | n8n | Zapier MCP | HeroPost | Direct APIs |
|---|---|---|---|---|
| **Setup ease for non-technical LOs** | Low for LO; owner/admin sets it up once, LOs never touch it | Low for LO; key set once by owner | **Highest** for LO (purpose-built scheduling UI) but separate login | Lowest; pure dev work, no LO-facing setup |
| **Cost** | Self-host ≈ infra only (cheap); n8n Cloud tiered | Per-task/usage Zapier pricing; can balloon with volume | Monthly SaaS per seat/workspace | API calls usually free/low; cost is dev + maintenance time |
| **Reliability** | Good if self-host is monitored; you own uptime | Depends on Zapier; opaque | Vendor-managed, generally solid | Highest ceiling; you own retries/idempotency |
| **Security** | Strong: self-hosted, secrets stay in your infra; **callback already HMAC fail-closed** | Weaker: key unlocks broad Zap surface; data transits Zapier | Vendor holds tokens + content; trust their posture | Strongest: tokens scoped + held by us; least third-party exposure |
| **OAuth handling** | n8n manages per-connection creds in its own vault | Zapier manages OAuth per connected app | HeroPost owns the social OAuth entirely | **We** own OAuth + refresh (most work, most control) |
| **Social publishing support** | Via nodes or by calling APIs from a node; flexible | Broad (FB/IG/LinkedIn/etc. via Zaps) | **Native + best UX** for scheduling/analytics | Full control per platform; we build each channel |
| **Google Drive support** | Drive node available | Drive Zaps available | Not its domain | Direct Drive API (read-only already gated in `driveStatus.ts`) |
| **Gmail support** | Gmail node available | Gmail Zaps available | Not its domain | Direct Gmail API (intake already half-built, dormant) |
| **Maintenance burden** | Medium: we patch/monitor n8n, but one place | Low code / but vendor + billing surface to watch | Lowest (vendor runs it) but least control | **Highest**: we maintain every connector + token refresh |
| **Per-team-member setup** | None for LOs (centralized); content flows through LegendsOS | None for LOs (centralized key) | **Each member may need their own connected social accounts/seat** | None LO-facing; all dev-side |
| **Risk of accidental live sends** | **Low today** — gated by `dispatch` + `ALLOW_LIVE_*` + no URLs wired | **Low today** — stub returns `not_configured`, nothing implemented | **Higher** — a real scheduler's whole purpose is to send; a misqueued post goes out | **Low–medium** — we control the gates, but a wired connector with a flag flipped will send |

---

## 4. Per-criterion narrative (the parts that actually matter)

### Risk of accidental live sends (the headline concern)
- **n8n (as wired here): low.** Three independent gates must all be true to send: caller passes `dispatch:true`, a webhook URL exists, and the relevant `ALLOW_LIVE_*` flag is on. Default state ships none of those. Inbound callback can't trigger a send.
- **Zapier MCP: low *because it's a stub*.** The danger is later: a single `ZAP_MCP_KEY` can unlock send-capable Zaps with little app-level gating. If built, it needs the same `ALLOW_LIVE_*` discipline and an allowlist of permitted Zap IDs.
- **HeroPost: structurally higher.** Its entire job is to publish on a schedule. Once accounts are connected, the failure mode is "a draft/test post actually goes live to a real audience." Harder to keep a hard OFF switch because the OFF switch lives in someone else's UI.
- **Direct APIs: low–medium and *ours to control*.** A connector that's been built and has a token will send the moment the flag flips. The mitigation is exactly the `publishStub` pattern already in `meta.ts`: keep `not_implemented_yet` / `paid_enabled_false` until approved.

### Security + OAuth
- **Strongest = direct APIs:** tokens are scoped (read-only Drive, page-publish Meta) and held in our infra; nothing transits a third party. The Drive helper already enforces read-only intent and exposes presence-not-values.
- **n8n self-hosted** keeps secrets in our infra too and the callback is already HMAC fail-closed — good posture. The outbound POST is currently unsigned (job-id header only); if we ever dispatch to n8n we should HMAC-sign outbound bodies to match the inbound rigor.
- **Zapier + HeroPost** both mean a third party holds tokens and sees content. Acceptable for low-sensitivity marketing posts; **not** acceptable for borrower PII, Gmail intake, or anything touching loan data.

### Non-technical LO experience + per-member setup
- The whole point of LegendsOS is that **LOs never touch automation plumbing.** n8n and a centralized direct-API approach both deliver that: the LO clicks "schedule post" in Social Studio, the owner-configured backend routes it. **No per-LO connection setup.**
- **HeroPost inverts this:** it tends to want each user/brand to connect their own social accounts and often a per-seat license — more onboarding friction for 14 people, and a second product to train them on.

### Maintenance + cost
- **n8n self-host:** one service to monitor; near-zero marginal cost; we own upgrades.
- **Direct APIs:** no vendor bill, but we maintain every connector and token-refresh path — real ongoing engineering.
- **Zapier:** lowest build effort, but per-task billing can surprise at volume and adds a vendor dependency for core flows.
- **HeroPost:** lowest maintenance, predictable SaaS bill, least control and a data-residency question.

---

## 5. Recommendation for Jeremy's team

**Keep n8n as the orchestration spine. Move toward direct platform APIs for the publish leg (Meta first, then GBP/YouTube). Leave Zapier MCP as an unbuilt escape hatch. Do not adopt HeroPost as core infrastructure.**

Why:
1. **It matches what's already built and safe.** The dispatcher, the HMAC fail-closed callback, the disabled Meta stub, and the gating flags are all consistent with "n8n routes, we publish, everything is off by default." Reuse beats rebuild.
2. **Best security/control fit for a mortgage team.** Borrower-adjacent data (Gmail intake, Drive, loan context) should never transit a third-party automation vendor. Self-hosted n8n + direct APIs keep tokens and content in our infra.
3. **Zero per-LO friction.** Centralized routing means the 14 team members never configure a connector — critical for non-technical LOs.
4. **HeroPost's strengths (nice scheduling UI, vendor-run uptime) don't outweigh its weaknesses here:** per-seat onboarding for 14 people, third-party token/content custody, and a live-send switch that lives outside our gates.
5. **Zapier is the right *fallback*, not the *foundation*.** Keep the stub. If a one-off niche connector is ever needed, build it behind an allowlist of approved Zap IDs and the same `ALLOW_LIVE_*` gates — but don't route core social/email through it.

**Use Zapier MCP only if:** a connector we need has no reasonable direct API and isn't worth self-building in n8n, AND the action is low-sensitivity (no PII), AND it's gated by an explicit Zap-ID allowlist + `ALLOW_LIVE_*`.

**Reconsider HeroPost only if:** the team explicitly wants individually-branded per-LO social scheduling with a polished standalone UI and is fine with a third party holding social tokens — i.e. a marketing-only, no-PII surface decoupled from LegendsOS core.

---

## 6. Phased rollout — live sends stay OFF until explicitly approved

Each phase ends behind an owner gate. **No phase auto-activates the next.** Live sending requires the owner to flip a specific flag per channel.

**Phase 0 — Today (current state, do nothing):**
- All paths queue-only. `ALLOW_LIVE_SOCIAL_PUBLISH=false`, `ALLOW_LIVE_EMAIL_SEND=false`, no webhook URLs, Zapier stub, Meta stub. Drive read-only and not live. **Confirmed safe.** Nothing to change in this sprint.

**Phase 1 — Documentation + correctness (safe, no sends):**
- Fix the AUTOMATION.md drift (HMAC is enforced inbound, not removed). *(Outside this lane's allow-list; note it for a docs PR.)*
- Decide outbound HMAC signing for the eventual n8n dispatch so outbound matches inbound rigor.
- No env changes, no activation.

**Phase 2 — Stand up self-hosted n8n in dry-run (no live sends):**
- Owner deploys n8n, sets `N8N_WEBHOOK_BASE_URL` + `N8N_WEBHOOK_SECRET` (callback can now verify), wires callback only.
- Keep `dispatch:false` everywhere and `ALLOW_LIVE_*=false`. Exercise the full queue → callback → status loop with **test** jobs that publish nothing.

**Phase 3 — Build the direct Meta publisher behind the stub (still no live sends):**
- Implement real publish inside the `meta.ts` shape, but keep it returning `not_implemented_yet` / `paid_enabled_false` until tested against a throwaway test page.
- `ALLOW_LIVE_SOCIAL_PUBLISH` stays `false`. Validate with `would_have_sent` summaries only.

**Phase 4 — Owner-approved limited live (one channel, owner only):**
- Owner explicitly flips `ALLOW_LIVE_SOCIAL_PUBLISH=true` for a single test channel, publishes one real post from the owner account, verifies the callback round-trip, then decides whether to keep it on.
- LO-initiated sends remain queued for owner review until trust is established.

**Phase 5 — Gradual team enablement:**
- Roll live publishing to LOs channel-by-channel, each behind owner review initially. Add email send (`ALLOW_LIVE_EMAIL_SEND`) only after social is proven. Revisit Zapier/HeroPost only if a concrete gap appears.

**Hard rule for every phase:** a live send must require an explicit owner action (a flag flip and/or an owner click). No load-time activation, no implicit defaults that send.

---

## 7. Honest status of each surface (as of this audit)

| Surface | Honest status | Basis |
|---|---|---|
| n8n routing | **setup needed** (code present, no instance/URLs wired) | `getN8nConfigState()` returns `configured:false` without base URL + webhook |
| n8n inbound callback security | **HMAC enforced / fail-closed** (good) | `verifyN8nSignature()` + `/api/automation/callback` reject without valid signature |
| Zapier MCP | **not connected** (intentional stub) | `triggerZap()` returns `not_configured`; nothing implemented |
| Meta (FB/IG) publish | **disabled** (detector + stub, zero outbound) | `publishStub()` never calls Meta; `paid_enabled` requires flag |
| Google Drive | **setup needed / sample mode** (hard-false connected) | `driveStatus.ts` `liveReadsAvailable()` returns `false` |
| HeroPost | **not connected / not in repo** | no references in codebase |
| Live social sends | **disabled** | `ALLOW_LIVE_SOCIAL_PUBLISH` default `false` |
| Live email sends | **disabled** | `ALLOW_LIVE_EMAIL_SEND` default `false` |

---

## 8. Open questions for Jeremy
1. Self-host n8n vs n8n Cloud? (Self-host = best security/cost; Cloud = less ops.)
2. Is per-LO individually-branded social scheduling a real requirement? If yes, that's the only scenario where HeroPost earns a second look (marketing-only, no PII).
3. Should the eventual outbound n8n dispatch be HMAC-signed to match the inbound callback? (Recommended: yes.)
4. Confirm: live sends require an explicit owner flag-flip per channel, never a default. (This audit assumes yes.)

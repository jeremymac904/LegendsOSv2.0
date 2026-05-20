# Hermes Workspace 2 → Atlas Integration Plan

**Sprint:** Atlas Hermes Workspace 2 integration
**Branch:** `claude/modest-maxwell-1b4647`
**Head before sprint:** `4b390f0`
**Reference repo:** `/Users/JeremyMcDonald/Desktop/reference_repos/hermes_workspace_2`
**Reference repo upstream:** NousResearch/hermes-agent — MIT licensed (pattern reference only; no code copy)
**Author:** Chief Integrator (Claude Opus 4.7 / 1M)

---

## 1. Why this plan exists

The current Atlas surface (`lib/atlas/intentDetection.ts`, `lib/atlas/toolRouter.ts`, `app/api/ai/chat/route.ts`) is a regex intent matcher that drives five hard-coded DB writes. It works, but it does not scale. Every new tool requires another regex + another branch + another bespoke insert + a friendly-error case. There is no manifest, no LLM-driven planner, no connector status surface, and no path for n8n / Zapier MCP tool calls.

This plan turns Atlas into a true agent workspace by extracting the patterns from the MIT-licensed Hermes Agent reference and re-implementing them in idiomatic TypeScript inside `lib/atlas/`, with:

* a single typed **tool registry** (one source of truth for name, description, JSON schema, handler, capability check, audit log shape),
* a **tool manifest API** at `/api/atlas/tools` that the UI reads to render chips, capability cards, and connector status without hard-coding tool names in React,
* an **LLM-driven tool planner** that supersedes the regex matcher (regex stays as a fast-path for the four highest-traffic verbs, but unrecognized phrasings now reach the planner instead of falling through to plain chat),
* an **MCP connector foundation** in `lib/mcp/` with three levels (owner-global, LO-personal, status UI),
* **plain-English errors** keyed only by env-var or connector NAME (never value), and
* honest action wording — Atlas always says "Saved as draft" not "Posted", never claims completions it cannot produce, never hallucinates rows.

---

## 2. Patterns extracted from Hermes Agent reference (MIT)

Read-only inspection of `~/Desktop/reference_repos/hermes_workspace_2` produced these patterns. We re-implement them in TypeScript — we do not copy code.

### 2.1 `tools/registry.py` — central tool registry

* Each tool file calls `registry.register(...)` at import time to publish: `name`, `toolset`, `schema`, `handler`, `check_fn`, `requires_env`, `description`, `emoji`, optional `max_result_size_chars`, optional `dynamic_schema_overrides`.
* `ToolEntry` is the canonical metadata record. `check_fn` returns a bool, gated by a ~30s TTL cache so env-var flips propagate within a turn.
* Discovery walks `tools/*.py`, AST-checks for a top-level `registry.register(...)`, and imports matching modules. We will not need AST discovery in TypeScript — a single import barrel file `lib/atlas/tools/index.ts` is enough.

**Adopted shape (TypeScript):**

```ts
// lib/atlas/tools/types.ts
export type AtlasToolStatus = "ready" | "needs_env" | "disabled" | "unavailable";

export interface AtlasToolMeta {
  id: string;                       // "create_social_draft"
  label: string;                    // "Draft a social post"
  description: string;              // one-line user-facing
  inputSchema: ZodSchema<unknown>;  // Zod, not JSON Schema — we already use Zod
  toolset: "draft" | "knowledge" | "asset" | "calendar" | "status" | "summary";
  requiresEnv: string[];            // env var NAMES only ("OPENROUTER_API_KEY")
  requiresConnector?: ConnectorId;  // "n8n" | "zapier_mcp" | "lo_personal_mcp" | "none"
  livePublishGate?: "social" | "email" | "image" | null;
  rolesAllowed: ProfileRole[];      // ["owner","admin","loan_officer","processor","marketing"]
  emoji?: string;                   // chip icon hint
}

export interface AtlasToolHandlerCtx {
  profile: Profile;
  supabase: SupabaseServerClient;
  serviceClient: SupabaseServiceClient;
  audit: (target: AuditTarget) => Promise<void>;
}

export interface AtlasToolHandler<I, O> {
  meta: AtlasToolMeta;
  status(env: ServerEnv): AtlasToolStatus;
  run(input: I, ctx: AtlasToolHandlerCtx): Promise<AtlasToolResult<O>>;
}

export type AtlasToolResult<O> =
  | { ok: true;  output: O;  card: AtlasToolCard }
  | { ok: false; error: AtlasToolErrorCode; message: string; envHint?: string };
```

### 2.2 `tools/mcp_tool.py` — MCP client surface

* Reads `mcp_servers:` from `~/.hermes/config.yaml`. Three transports: stdio (child process), Streamable-HTTP (URL), SSE.
* Per server: `command`, `args`, `env`, `url`, `headers`, `timeout`, `connect_timeout`, `supports_parallel_tool_calls`, `sampling` (server-initiated LLM requests with rate limits + model whitelist).
* Discovers each server's tools and registers them into the same `tools/registry.py` — i.e. native and MCP tools are indistinguishable downstream.

**Adopted shape:**

* `lib/mcp/types.ts` — `MCPConnectorDef` (id, label, scope: `owner_global | lo_personal`, transport: `n8n_webhook | zapier_remote | hermes_local | browser_local`, status, env var names, auth field names — NEVER values).
* `lib/mcp/registry.ts` — pure read of env + DB to compute connector status (no live HTTP probes during a chat turn; cache for 30s like the reference).
* MCP tools are **NOT** unified into the same execution path in this sprint. v1 ships **native tool execution + MCP status surfacing**. Atlas can report on MCP connector readiness, but actual MCP tool invocation is a future sprint (the manifest is ready for it).

### 2.3 `tools/managed_tool_gateway.py` — gateway in front of handlers

* Normalizes input, applies output size limits, redacts secrets in tool output, attaches structured result for the UI.
* We adopt this as **`lib/atlas/runtime/gateway.ts`** — a single `executeTool({ toolId, input, ctx })` that wraps every handler with: input validation (Zod), capability check (`status() === "ready"`), role check (`rolesAllowed.includes(profile.role)`), audit log write on success, and a normalized error envelope on failure. The chat route stops doing any of these things directly.

### 2.4 `tools/registry.py` TTL cache

* `check_fn` results cached ~30s. We adopt a `LRUCache<string, AtlasToolStatus>` keyed by `${toolId}:${envHash}` with `ttl = 30s`. Avoids re-reading env on every keystroke and survives the soft TTLs the rest of the codebase uses (cap window is 24h, this is much shorter).

### 2.5 What we explicitly DO NOT adopt

* Tool-spawning sub-agents (`delegate_tool.py`) — out of scope, would require a job queue we don't have.
* `clarify_gateway.py` clarify-loop — the chat already does this naturally.
* Sandboxed code-execution tools — explicitly forbidden by repo CLAUDE.md (no new vendors, no compliance review surface).
* `cronjob_tools.py` — owner already uses n8n + Hermes cron; LegendsOS does not schedule cron from chat.
* Server-initiated LLM sampling from MCP servers — adds attack surface, deferred.

---

## 3. New file layout (this sprint)

```
lib/atlas/
  intentDetection.ts          # KEEP — fast path for high-traffic verbs
  toolRouter.ts               # SHRINKS — re-exports gateway; legacy callers untouched
  retrieval.ts                # UNCHANGED
  runtime/
    types.ts                  # AtlasToolMeta, AtlasToolHandler, AtlasToolCard
    gateway.ts                # executeTool() with audit + role + status + Zod
    planner.ts                # LLM tool-call planner (fallback after intentDetection)
    statusCache.ts            # 30s TTL cache for tool.status()
    manifest.ts               # buildManifest(profile) — used by /api/atlas/tools
  tools/
    index.ts                  # barrel: imports every tool module so they self-register
    createSocialDraft.ts      # was inline in toolRouter
    createEmailDraft.ts
    createCalendarItem.ts
    createKnowledgeNote.ts
    searchKnowledge.ts        # NEW — wraps retrieval.ts
    retrieveAsset.ts          # NEW — SELECT from assets
    checkProviderStatus.ts    # NEW — read-only env snapshot
    checkN8nReadiness.ts      # NEW — env var presence check
    prepareImagePrompt.ts     # NEW — structured prompt, no live gen
    attachAssetToSocial.ts    # NEW — update social_posts.metadata
    createHandoffSummary.ts   # NEW — concise human handoff line
    explainCapabilities.ts    # MOVED from toolRouter

lib/mcp/
  types.ts                    # MCPConnectorDef, MCPConnectorStatus
  registry.ts                 # listConnectors(profile): MCPConnectorDef[]
  scopes/
    ownerGlobal.ts            # n8n + Zapier MCP placeholder + Hermes/local placeholders
    loPersonal.ts             # wraps mcp_connections table (per-user)
  status.ts                   # computeStatus(def, env, dbRows): MCPConnectorStatus

app/api/atlas/
  tools/route.ts              # GET → { tools: [], connectors: [] } manifest

components/atlas/
  AtlasShell.tsx              # MINOR — read manifest, render connector strip + chips
  ConnectorStatusStrip.tsx    # NEW — small horizontal pills along top of chat
  ToolResultCard.tsx          # EXTRACT from AtlasShell.tsx (it's inline today)
```

---

## 4. Sprint-scope tool catalog

| Tool id | Inserts | RolesAllowed | RequiresEnv | RequiresConnector |
|---|---|---|---|---|
| `create_social_draft` | social_posts (status=draft) | non-viewer | — | none |
| `create_email_draft` | email_campaigns (status=draft) | non-viewer | — | none |
| `create_calendar_item` | calendar_items | non-viewer | — | none |
| `create_knowledge_note` | knowledge_items + maybe knowledge_collections | non-viewer | — | none |
| `search_knowledge` | (read) knowledge_items via retrieval | any | — | none |
| `retrieve_asset` | (read) assets | any | — | none |
| `check_provider_status` | (read) env snapshot | any | — | none |
| `check_n8n_workflow_readiness` | (read) env names only | any | — | n8n (optional check) |
| `prepare_image_generation_prompt` | (read) — structured prompt only | non-viewer | — | none |
| `attach_asset_to_social_draft` | UPDATE social_posts.metadata.assets[] | non-viewer | — | none |
| `create_handoff_summary` | (read) build a short summary string | non-viewer | — | none |
| `explain_capabilities` | (read) manifest + connector status | any | — | none |

**Live external actions remain gated**. None of the above bypass `ALLOW_LIVE_SOCIAL_PUBLISH` or `ALLOW_LIVE_EMAIL_SEND`. The composers continue to be the only place where live actions can be enqueued, and even then only when the owner flips the flag manually.

---

## 5. Planner contract

Today: regex match → tool router. Tomorrow: regex match → tool router (fast path) → if no match, call planner with the registry manifest → if planner returns a tool call with high confidence, execute → else fall through to normal chat.

Planner contract (request → DeepSeek / OpenRouter via existing `runChat`):

```
SYSTEM PROMPT:
You are Atlas's tool planner. You receive the user message and the list of
available tools. Reply with strict JSON: { "tool": "<id>" | null,
"input": { ... } | null, "confidence": 0..1, "rationale": "<one line>" }.
Never return any tool not in the list. Never invent fields. If unsure, set
tool: null. Drafts only — never publish or send.

TOOLS:
[{id, label, description, inputSchema (Zod printed as JSON-Schema fragment)}, ...]
```

Confidence threshold: 0.70. Below threshold = fall through to normal chat.
Failure modes (provider unconfigured, JSON parse, schema validation) = silent fallthrough — never block the chat.
Cap exposure: one planner call per user message, charged to the same daily cap row as a regular chat turn.

---

## 6. MCP foundation — three levels

### L1 — Owner-global connectors

Source-of-truth = `lib/mcp/scopes/ownerGlobal.ts`. Read-only at runtime.

| Connector id | Status sources | Tools surface |
|---|---|---|
| `n8n` | env: `N8N_BASE_URL`, `N8N_WEBHOOK_SOCIAL_PUBLISH`, `N8N_WEBHOOK_EMAIL_SEND` | `check_n8n_workflow_readiness` |
| `zapier_mcp` | env: `ZAPIER_MCP_API_KEY` (placeholder — handoff doc says key received, not wired) | none yet (placeholder card) |
| `hermes_local` | env: `HERMES_LOCAL_URL` (placeholder; not in `.env.local` today) | none yet |
| `browser_local` | env: `BROWSER_AUTOMATION_ENABLED` (placeholder) | none yet |

Each entry exposes: `id`, `label`, `scope: "owner_global"`, `status: "connected"|"disabled"|"not_configured"`, `requiresEnv: string[]` (NAMES), `tools: string[]` (ids that depend on it), `setupHint: string`.

### L2 — Loan-officer personal connectors

Backed by existing `mcp_connections` table from migration `20260518000000_create_mcp_connections.sql`. RLS-enforced — each LO only sees their own.

`listLoPersonalConnectors(profile)` returns rows mapped to `MCPConnectorDef`. The `auth_token` column is NEVER returned to the UI — only a boolean `hasToken: true|false`.

This sprint ships **read + status surface only**. A future sprint wires those personal connectors to actual MCP tool invocation.

### L3 — Status UI

Two surfaces:

* **Settings → Integrations** — full table of L1 connectors with setup hints, plus L2 personal connector list (read; the existing add/remove UI from commit `9b26ccd` stays as-is).
* **Atlas chat header strip** — compact pill row of L1 connectors, color-coded (green = connected, amber = configured-but-disabled, gray = not configured). Click → jumps to Settings → Integrations anchor.

---

## 7. AtlasShell + UI changes

* Move inline `ToolResultCard` out of AtlasShell into `components/atlas/ToolResultCard.tsx` so the planner-driven manifest can render the same card without duplicating JSX.
* New `<ConnectorStatusStrip />` above the chat scroller. Reads `/api/atlas/tools` once on mount + every 60s.
* `<MessageRow />` now reads `tool_result.kind` from a closed enum (`AtlasToolKind`) so adding a new tool only requires registering it — no UI changes.
* Empty state: when no tools are configured (e.g. user is viewer), show a one-line note and link to Settings.

---

## 8. Honest action wording rules

Atlas wording must always tell the truth about what happened:

| State | Wording |
|---|---|
| Draft row inserted, no live action | "Saved your <kind> as a draft. Open it: <link>" |
| Draft row inserted, live flag would be needed | append " — I won't publish/send unless you flip ALLOW_LIVE_<X>." |
| Cap exceeded | "Daily Atlas message cap reached (<used>/<cap>). Ask Jeremy to lift the cap." |
| Provider unconfigured | "<Provider> isn't configured (env var <NAME>)." (NAME only) |
| Connector unavailable | "<Connector> isn't connected. Set <ENV_NAME> in Netlify env, then ask me again." |
| Planner uncertain | normal chat — no tool claim |
| RLS rejection | "I tried to save your <kind> but your role doesn't have write access — ask the owner." |

Atlas NEVER:

* claims to have "posted" or "sent" anything,
* prints any env var VALUE (key, secret, URL, token),
* invents row IDs (every claimed itemId is checked-back from the insert response).

---

## 9. Track ↔ owner mapping for this sprint

| Track | Owner agent | Files (canonical, no cross-track overlap) |
|---|---|---|
| T2 | `legendsos-atlas-hermes-engineer` | `lib/atlas/runtime/**`, `lib/atlas/tools/**`, `lib/atlas/toolRouter.ts` (shrink), `app/api/atlas/tools/route.ts`, `app/api/ai/chat/route.ts` (wire planner), `components/atlas/ToolResultCard.tsx` (extract) |
| T7 | `legendsos-atlas-hermes-engineer` | `lib/mcp/**`, `components/atlas/ConnectorStatusStrip.tsx`, Settings integrations section |
| T1 | `legendsos-ui-jarvis-designer` | `app/(app)/**/page.tsx` styling, `components/**` styling, login |
| T3 | `legendsos-marketing-studio-builder` | `app/(app)/social/**`, `app/(app)/email/**`, `components/social/**`, `components/email/**`, `lib/email/render.ts` |
| T4 | `legendsos-calendar-planner` | `app/(app)/calendar/**`, `components/calendar/**` |
| T5 | `legendsos-admin-ops-builder` | `app/(app)/admin/**`, `components/admin/**`, `app/api/admin/**` |
| T6a | `legendsos-admin-ops-builder` | `app/(app)/admin/assets/**`, `components/admin/AssetsPanel.tsx` |
| T6b | `legendsos-knowledge-ingestion-engineer` | `app/(app)/knowledge/**`, `components/knowledge/**`, `lib/atlas/retrieval.ts` |
| T8 | `legendsos-smoke-verifier` | (verify only, no edits) |
| T9 | `legendsos-release-reporter` | (final report only) |

---

## 10. Safety + non-negotiables (recap)

* No HMAC, no approval queues, no compliance surfaces, no quotas, no new vendors.
* No edits to `.env.local`, `netlify-production-import.env`, or `supabase/migrations/*` in this sprint.
* Never print or log a secret value. Atlas reports env var NAMES only.
* Never delete Jeremy's profile, his auth row, or any production row.
* Drafts only — `ALLOW_LIVE_*` flags stay where they are.
* `.eslintrc` keeps `"root": true` (worktree memory note).
* Commit only when lint + typecheck + build are green.
* One push, one deploy, at the END after all 7 tracks are green and local smoke passes.

---

## 11. Smoke checklist (A → F)

Run twice — once locally before push, once live against `https://legndsosv20.netlify.app` after deploy ready.

* **A — Atlas chat regression**
  1. "What can you do?" → renders capability card (tools + providers + n8n + connector strip).
  2. Normal mortgage question → standard chat fall-through (no tool chip).
  3. "Draft a Facebook post about FHA buyer tips" → `social_posts` row INSERT + tool chip.
  4. "Write a newsletter about credit score boost" → `email_campaigns` row INSERT + tool chip.
  5. "Schedule team standup on Monday" → `calendar_items` row INSERT + tool chip + calendar deep-link with `?focus=`.
  6. "Save a note about my closing checklist" → `knowledge_items` row INSERT (auto-create "Atlas Notes" collection if missing).
* **B — Studios**
  * Reopen a social draft after navigating away — body + channels + assets persist.
  * Reopen an email draft — audience selection + audience count persist.
* **C — Calendar**
  * Grid renders, prev/next/today nav works, chips color-coded, Atlas-created item appears in correct cell.
* **D — Knowledge**
  * Upload one PDF + one markdown file; Atlas search returns at least one citation.
* **E — Admin**
  * Non-owner profile receives 302 on every `/admin/**` GET.
  * Audit log shows a row for every privileged write performed during the smoke.
* **F — MCP status**
  * `/api/atlas/tools` returns valid JSON with at least one connector entry and no secret values.
  * Settings → Integrations renders L1 + L2 connector lists; no secret values visible in HTML.

---

## 12. Risk + mitigation

| Risk | Mitigation |
|---|---|
| Planner JSON parse failure breaks chat | Silent fallthrough to normal chat; no user-facing error |
| Tool registry self-import causes circular deps | Barrel only imports leaf modules; runtime imports only `runtime/` |
| MCP status probes hit n8n during chat | Status is env-only (no HTTP probe in v1) |
| AtlasShell extraction causes prop drift | ToolResultCard receives a typed `tool_result` payload identical to existing |
| Worktree eslint breakage | `.eslintrc` already has `"root": true` (memory note) |
| Live action accidentally enabled | Never edit `.env.local`; never call `/api/social` with `dispatch=true` in tests |
| Atlas claims a row that wasn't inserted | Every tool returns the row only after a successful `.single()` with no error |

---

## 13. End conditions

* All 7 code tracks committed locally, each with lint+typecheck+build green.
* Local smoke A→F passes.
* Single push to `origin claude/modest-maxwell-1b4647`.
* Netlify deploy `state === "ready"` within 5 min.
* Live smoke A→F passes as `jeremy@mcdonald-mtg.com`.
* `legendsos-release-reporter` produces a single consolidated final report.

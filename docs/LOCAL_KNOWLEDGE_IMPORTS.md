# Local Knowledge Imports

LegendsOS reads selected folders from `future/` (gitignored, never
committed) and imports the text content into Supabase as
`knowledge_collections` + `knowledge_items` rows. Atlas assistants are
wired to those collections via `assistant_knowledge_access`, so the
relevant snippets get auto-injected at chat time.

## Run the importer

```bash
# Real run (writes to Supabase via service role).
npm run import-local-knowledge

# Dry run (plan only — no DB writes).
DRY=1 npm run import-local-knowledge
```

The script is **idempotent**:

- Collections looked up by `(organization_id, name)` — created if new,
  updated otherwise.
- Items looked up by `metadata.source_path` (the file's path relative to
  the repo root) and content hash. Unchanged files are skipped.

Safe by construction:

- Only `.md / .txt / .csv / .json` files are imported.
- Anything over **256 KB** per file is recorded as a pointer ("source
  too large — see <path>") instead of pulled into the DB.
- Files whose names look like secrets (`.env`, `.env.*`, `*.pem`, `*.key`)
  are skipped.
- Directories named `node_modules`, `.git`, `.next`, `dist`, `build`,
  `__MACOSX`, `__pycache__`, `.venv`, `venv` are skipped.

## Sources imported

| Collection | Source folder | Visibility | Items (last run) |
| --- | --- | --- | --- |
| **Loan Factory AI Assistants** | `future/Loan_Factory_AI_Assistants` (excluding M&R) | `team_shared` | 127 |
| **Loan Factory Marketing & Recruiting** | `future/Loan_Factory_AI_Assistants/Loan_Factory_Marketing_Recruiting_Assistant_UPLOAD_READY` | `private` (owner-only) | 12 |
| **Loan Factory Training** | `future/LoanFactory Training` | `team_shared` | 108 |
| **Loan Factory Social Media Assistant** | `future/LoanFactory_Social_Media_Assistant_ELITE_v1` | `team_shared` | 15 |
| **Legends Realtor Coach Knowledge** | `future/legends_realtor_coach_knowledge` | `team_shared` | 11 |
| **28 Day Social Templates** | `future/28 Days Social Media Templates Legends` | `private` | 0 (PNG-only) |
| **40 Day Jeremy Social Templates** | `future/40 Days Social Media Templates for Jeremy` | `private` | 0 (PNG-only) |
| **Jeremy YouTube Video Inventory** | `future/# YouTube Video Inventory — Jeremy McDonald, The Mortgage Mentor.md` | `private` | 1 |

**274 items total** across 8 collections (last full run).

> Why `private` instead of `owner_only`?  The Postgres enum
> `knowledge_visibility` is `('private','team_shared')`. The RLS policies
> grant `private` rows to (a) the creator and (b) any `owner` role
> member, which is functionally identical to "owner-only" for our setup.

## What gets skipped — by category

Each run prints a per-collection summary like:

```
OK Loan Factory AI Assistants    vis=team_shared  +127/=0/~0  skip(ext=11,size=0,sus=0)
```

- `+127` inserted
- `=0` unchanged (hash matched)
- `~0` updated (hash differed)
- `skip(ext=11)` — files with an unsupported extension (e.g. .json that
  the importer chose not to ingest, image binaries, archives)
- `skip(size=…)` — files over the 256 KB cap
- `skip(sus=…)` — files whose names suggest secrets

## Assistant ↔ collection wiring

The importer wires each collection to one or more of the seeded
assistants via `assistant_knowledge_access`. The mapping mirrors what
Jeremy specified in the sprint plan:

```
AI Mortgage Coach        ← Loan Factory AI Assistants + Training
Credit AI Assistant      ← Loan Factory AI Assistants + Training
Elite LO Assistant       ← Loan Factory AI Assistants + Training
Real Estate Investor     ← Loan Factory AI Assistants
Realtor Coach            ← Legends Realtor Coach Knowledge
Marketing & Recruiting   ← Loan Factory Marketing & Recruiting (owner-only)
Social Media / Content   ← Social Media Assistant + 28 Day + 40 Day + YouTube Inventory
```

13 rows total.

## How retrieval uses these

See `docs/ATLAS_KNOWLEDGE_ROUTING.md`. TL;DR: when a user sends a message
on `/atlas` with an assistant selected, the chat route extracts keywords
from the message, runs an `ilike` OR-match across `knowledge_items.title`
and `content`, ranks by hit count (title hits weighted 3×), returns up
to 5 snippets, and injects them as a trailing system-prompt block.
`retrieval_references` rows are written so each assistant message has a
back-pointer to the items used.

## Where the panel lives in the UI

`/knowledge` (top of page, owner-only) shows a **Local knowledge imports**
table — collection name, visibility, item count, last imported. Clicking
a row opens that collection's detail page.

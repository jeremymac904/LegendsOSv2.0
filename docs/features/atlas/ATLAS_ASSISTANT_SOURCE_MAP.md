# Atlas Assistant Source Map

Six Loan Factory assistants are seeded into the `atlas_assistants` table
from local kit folders under `future/Loan_Factory_AI_Assistants/`. The
seed script is **idempotent** — re-running updates existing rows by
`(organization_id, name)` instead of duplicating.

```bash
npm run seed-assistants
```

## Source → assistant mapping

| Assistant | Source kit folder | Prompt file resolved | Default visibility |
| --- | --- | --- | --- |
| Loan Factory AI Mortgage Coach | `Loan_Factory_AI_Mortgage_Coach_Build_Package` | `01_MAIN_INSTRUCTIONS/Master_System_Instructions.md` (recursive walk) | `team_shared` |
| Loan Factory Credit AI Assistant | `Loan_Factory_Credit_AI_Assistant_Kit` | `01_System_Instructions.md` (preferred) → `15_Master_Assistant_Prompt.md` | `team_shared` |
| Loan Factory Elite LO Assistant | `Loan_Factory_Elite_LO_Assistant_Build_Kit` | First match for *Master Prompt* / *System Instructions* | `team_shared` |
| Loan Factory Real Estate Investor Assistant | `Loan_Factory_RE_Investor_Assistant_Knowledge_Pack` | `README.md` (kit doesn't ship a master prompt) | `team_shared` |
| Loan Factory Realtor Coach | `LoanFactory_RealtorCoach` | `10_Assistant_Instructions.md` | `team_shared` |
| Loan Factory Marketing & Recruiting Assistant | `Loan_Factory_Marketing_Recruiting_Assistant_UPLOAD_READY` | `00_CUSTOM_GPT_INSTRUCTIONS.md` | **`owner_only`** (Jeremy specified) |

The seed script's prompt-file picker tries the flat candidates first
(`15_Master_Assistant_Prompt.md`, `10_Assistant_Instructions.md`,
`01_System_Instructions.md`, `00_CUSTOM_GPT_INSTRUCTIONS.md`,
`Master_System_Instructions.md`, `README.md`) and falls back to a
recursive walk (depth ≤ 3) for any markdown file whose name matches
`master.*prompt | system.*instruction | assistant.*instruction |
custom.*gpt.*instruction`.

Each row carries metadata for traceability:

```json
{
  "source_kit": "Loan_Factory_Credit_AI_Assistant_Kit",
  "source_root": "future/Loan_Factory_AI_Assistants/Loan_Factory_Credit_AI_Assistant_Kit",
  "seeded_by": "scripts/seed-atlas-assistants-from-local.ts",
  "seeded_at": "2026-…",
  "config": { /* contents of assistant_config.json if present */ }
}
```

## Visibility model

- **`team_shared`** — visible to every member of the organization in the
  Atlas Chat assistant picker.
- **`owner_only`** — visible only to Jeremy.

The "Marketing & Recruiting" assistant is the only one kept owner-only by
default per Jeremy's note in the walkthrough. Flip it later via:

```sql
update public.atlas_assistants
   set visibility = 'team_shared'
 where name = 'Loan Factory Marketing & Recruiting Assistant';
```

## Re-running

The seed script reads `.env.local` for `SUPABASE_SECRET_KEY`. After kit
edits (e.g. you tweak the `01_System_Instructions.md` of one kit), run:

```bash
npm run seed-assistants
```

It will report `UPDATED` for changed rows and `CREATED` for new ones.

## Out of scope (deferred)

- Importing the **knowledge documents** that ship alongside each kit (e.g.
  `02_KNOWLEDGE_DOCUMENTS/*.md`) into `knowledge_collections` /
  `knowledge_items` — covered by the Knowledge Sources import workflow
  on `/knowledge`.
- Per-assistant access controls beyond `team_shared` / `owner_only`
  (e.g. per-user grants) — RLS already supports it; UI is a future pass.

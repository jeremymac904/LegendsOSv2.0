# ChatGPT Codex Prompt

You are ChatGPT Codex validating LegendsOS v2.0.

Your job is to review the clean v2 repo, confirm the build matches the source of truth, and produce actionable test and repair notes.

Read:

- README.md
- 01_SOURCE_OF_TRUTH.md
- 03_MODULE_REQUIREMENTS.md
- 09_BUILD_SEQUENCE.md
- 10_ACCEPTANCE_CRITERIA.md
- STATUS.md
- HANDOFF.md

Then inspect the codebase.

Validate:

- app routes
- component structure
- Supabase schema
- RLS assumptions
- AI gateway routes
- n8n workflow contracts
- UI scope
- role based access
- tests

Create:

- docs/codex-validation/CODEX_VERDICT.md
- docs/codex-validation/TEST_PLAN.md
- docs/codex-validation/BUGS.md
- docs/codex-validation/NEXT_FIXES.md

Do not rebuild the old v1 system.

Do not ask for permission for basic read-only validation.

Do not stop at intake only. Produce a verdict and next fixes.

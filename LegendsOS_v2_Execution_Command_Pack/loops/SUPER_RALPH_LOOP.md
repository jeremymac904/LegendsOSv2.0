# Super Ralph Loop

Use when multiple agents are working.

## Cycle

1. AI CEO reviews status.
2. Product Architect confirms scope.
3. Backend Engineer confirms schema.
4. Frontend Engineer builds UI.
5. AI Gateway or n8n Engineer wires integrations.
6. Security Auditor checks permissions.
7. QA runs tests.
8. Documentation Agent writes handoff.
9. Release Manager prepares commit/deploy notes.

## Parallel work rules

Allowed parallel lanes:

- UI components
- Supabase schema
- AI gateway
- n8n workflow contracts
- tests
- documentation

Do not let two agents edit the same file at the same time.

## Required final artifacts

- STATUS.md
- HANDOFF.md
- NEXT_ACTIONS.md
- TEST_RESULTS.md
- CHANGELOG.md

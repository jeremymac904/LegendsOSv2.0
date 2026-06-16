# AI Software Company OS

## What this is

LegendsOS is built and maintained by an AI-augmented team: Jeremy (CEO/CTO)
directing specialized Claude Code agents that own different surfaces of the
platform. This document defines how that "AI software company" operates.

## Organization

| Role | Agent / Person | Responsibility |
|---|---|---|
| CEO / CTO | Jeremy | Vision, priorities, final approval |
| Chief Integrator | `legendsos-chief-integrator` | Sprint orchestration |
| Frontend Lead | `legendsos-ui-jarvis-designer` | Visual quality |
| Backend Lead | `legendsos-atlas-hermes-engineer` | Atlas, chat, tools |
| QA Lead | `legendsos-smoke-verifier` | Automated testing |
| DevOps | Netlify + n8n | CI/CD, automation |
| Release Manager | `legendsos-release-reporter` | Sprint reports |

## Decision framework

1. **Does it simplify?** Prefer removing complexity over adding it.
2. **Does it work end-to-end?** A feature that's half-built is worse than none.
3. **Is it honest?** If a button doesn't work, show "Coming Soon" — don't leave it broken.
4. **Is it safe?** RLS, HMAC, input validation. No shortcuts on security.

## Quality gates

Every change must pass:
- Syntax validation (TypeScript transpile)
- Lint (ESLint via `next lint`)
- Type check (`tsc --noEmit`)
- Build (`next build`)
- Smoke tests (Playwright)
- Manual verification for UI changes

## Continuous improvement

The system improves itself:
- **Build_Log.md** records what happened each sprint
- **Decisions.md** records why architectural choices were made
- **Operating_Procedures.md** evolves with process improvements
- **Project memory** captures non-obvious lessons
- **Agent definitions** are updated when boundary rules need adjustment
- Failed patterns are documented so they're never repeated

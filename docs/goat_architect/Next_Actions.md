# LegendsOS — Next Actions

## Done (2026-06-16)

- ~~Add CI/CD pipeline~~ → `.github/workflows/ci.yml` (lint + typecheck + build)
- ~~Update `.env.example`~~ → expanded 86 → 163 lines, all referenced vars
- ~~Ship AI Chief of Staff v1~~ → `/chief-of-staff` (see `AI_CHIEF_OF_STAFF_V1.md`)

## Immediate (this week)

1. **Install toast library** — sonner or react-hot-toast for action feedback
2. **Add Content-Security-Policy** to `netlify.toml`
3. **Fix mobile tables** — change `overflow-hidden` to `overflow-x-auto`
4. **Chief of Staff v2 — quick wins:** add `loan_tasks`/`loan_conditions`
   signals to "Loans Needing Attention"; add dismiss/snooze on cards
5. **Surface orphan routes** — wire `/onboarding`, `/shared`, `/automation`
   into navigation or redirect flows

## Next sprint

6. **Unify AI chat backends** — merge Atlas into the agent runtime
7. **Merge connection surfaces** — one IntegrationStatusGrid component
8. **Add Google OAuth** — Gmail, Drive, Calendar real integration
9. **Add pagination** to asset library and user list

## Future

10. **Knowledge vector search** — embeddings for semantic retrieval
11. **Global search (⌘K)** — cross-entity search
12. **Meta publishing** — real Facebook/Instagram API
13. **Desktop app signing** — Apple Developer ID + Windows build

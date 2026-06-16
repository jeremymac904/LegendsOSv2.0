# LegendsOS — Operating Procedures

## Sprint execution

1. **Brief** — Define sprint goal in 1-2 sentences
2. **Dispatch** — Chief Integrator splits into parallel tracks
3. **Build** — Specialist agents execute within their boundaries
4. **Validate** — Lint, typecheck, build, Playwright smoke tests
5. **Repair** — Fix failures, loop until green
6. **Verify** — Smoke Verifier runs automated page walks
7. **Report** — Release Reporter writes the sprint summary
8. **Deploy** — Push to main → Netlify auto-deploys

## Commit conventions

- Prefix: `[SECTION]` — e.g., `[ATLAS]`, `[ADMIN]`, `[SOCIAL]`, `[TRAINING]`
- One logical change per commit
- No `--no-verify` or `--force`

## Before deploying

- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes (use Node 18/20)
- [ ] `npm run build` passes
- [ ] `npm run test:e2e` passes (32 Playwright tests)
- [ ] No secrets in committed files
- [ ] Safety gates checked: `ALLOW_LIVE_SOCIAL_PUBLISH`, `ALLOW_LIVE_EMAIL_SEND`

## Adding a new page

1. Create `app/(app)/your-page/page.tsx`
2. Add profile check: `if (!profile) return <EmptyState .../>`
3. Add role gate if needed: `if (!isOwner(profile)) redirect("/dashboard")`
4. Add to `lib/navigation.ts` if it should appear in sidebar
5. Add to Playwright smoke tests in `e2e/`

## Adding a new integration

1. Create lib module in `lib/integrations/`
2. Add API route in `app/api/integrations/`
3. Add env vars to `.env.example`
4. If not yet functional, gate with "Coming Soon" in the UI
5. Document in `docs/architecture/`

## Genetic improvement

After every sprint:
1. Record what worked and what didn't in Build_Log.md
2. Update Operating_Procedures.md if a process gap caused issues
3. Update agent definitions if boundary rules need adjustment
4. Save non-obvious lessons to project memory

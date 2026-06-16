# LegendsOS — Open Issues

## Architecture

- [ ] **Two AI chat backends** — Atlas and Agent Runtime should be unified
  into one system. Atlas becomes `agentType: "owner_atlas"` in the agent
  definitions. ~1,000 LOC of duplicated session/tool code goes away.

- [ ] **Three connection surfaces** — IntegrationConnections (824 LOC),
  ConnectionCenter (1,359 LOC), and admin/setup grid overlap. Should be one
  scope-aware `IntegrationStatusGrid` component.

## Security

- [ ] **No Content-Security-Policy header** — `netlify.toml` needs CSP
- [ ] **No CI/CD pipeline** — any push to main deploys without lint/typecheck
- [ ] **`.env.example` outdated** — 30+ env vars undocumented
- [ ] **Email audience import lacks role restriction** — viewer can call CSV import
- [ ] **MCP connections saved but never used at runtime**

## UX

- [ ] **No toast/notification system** — actions have no feedback
- [ ] **Tables clip on mobile** — `overflow-hidden` instead of `overflow-x-auto`
- [ ] **Calendar not responsive** — `grid-cols-7` hardcoded
- [ ] **Hover-only actions** — inaccessible on touch devices
- [ ] **No global search** — ⌘K not implemented
- [ ] **No profile editing in Settings**
- [ ] **No pagination** on asset library, user list, or usage page

## Integrations

- [ ] **Google OAuth** — UI present, no backend
- [ ] **Zapier MCP** — every function returns "not_configured"
- [ ] **Meta publishing** — publishStub returns not_implemented_yet
- [ ] **Knowledge embeddings** — keyword-only, no vector search

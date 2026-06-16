# LegendsOS — Architecture

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Auth & DB | Supabase (Postgres + Auth + Storage + RLS) |
| Styling | Tailwind CSS + custom theme system |
| AI Gateway | OpenRouter, DeepSeek, NVIDIA, Fal.ai (image) |
| Automation | n8n (webhook dispatch + callback) |
| Deployment | Netlify (SSR functions + CDN) |
| Desktop | Electron shell (optional) |

## Directory structure

```
app/
  (app)/           → Authenticated route group (layout with sidebar + topbar)
  api/             → API routes
    ai/            → Atlas chat + image generation + status
    agents/        → Agent runtime (FLO, Marketing Assistant, etc.)
    goat/          → External Custom GPT API (not used by UI)
    integrations/  → OAuth, connections, publishing
    webhooks/      → Inbound webhooks (lead, email, document intake)
  auth/            → Auth callback + password set
  login/           → Login page

components/
  admin/           → Admin Center, ConnectionCenter, AdminNav, UserManager
  agents/          → AgentChat, AgentSidebar
  atlas/           → AtlasChat, LOWorkspace, tools
  shell/           → Sidebar, TopBar, MobileNav
  settings/        → IntegrationConnections, ProviderToggle, SettingsNav
  training/        → AcademyNav, trackers, resources
  ui/              → Shared components (Tabs, StatusPill, EmptyState, etc.)

lib/
  ai/              → Provider gateway, model config
  agents/          → Agent definitions, runtime, tools
  goat/            → GOAT Command API business logic
  integrations/    → Google, Meta, Zapier connectors
  supabase/        → Client/server helpers, middleware
```

## Data flow

1. User → Next.js page (SSR) → Supabase RLS query → render
2. Chat → `/api/ai/chat` or `/api/agents/chat` → AI gateway → stream response
3. Publish → Social/Email composer → `/api/social` or `/api/email` → draft saved
4. Automation → n8n webhook dispatch → n8n workflow → callback → status update
5. Knowledge → Upload → Supabase storage → keyword index → Atlas retrieval

## Security model

- All tables protected by RLS (row-level security)
- Service-role client used only in API routes, never client-side
- GOAT API authenticated via `GOAT_COMMAND_API_KEY` header
- n8n callbacks verified via HMAC signature
- Auth redirects sanitized against open-redirect attacks
- MCP tokens encrypted at rest

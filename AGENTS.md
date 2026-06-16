# LegendsOS v2.0 — Agent Definitions

These specialized Claude Code agents live in `.claude/agents/` and are invoked
via the `Agent` tool during sprints. Each agent owns a specific surface of the
platform and refuses to edit outside its boundary.

## Sprint agents

| Agent | Owns | Key rules |
|---|---|---|
| **chief-integrator** | Sprint orchestration | Reads sprint goal, splits tracks, dispatches sub-agents, merges, validates, commits |
| **admin-ops-builder** | Admin Center, Users, Assets, Audit | Refuses to weaken owner-only gates or expose service-role key client-side |
| **atlas-hermes-engineer** | Atlas chat gateway, tools, threads, knowledge retrieval | Refuses to redesign non-Atlas pages |
| **calendar-planner** | Calendar views, content reminders, CRUD | Refuses to enable Google sync until OAuth is wired |
| **knowledge-ingestion-engineer** | Knowledge sources, document ingestion, citations | Refuses to import secrets or env files |
| **marketing-studio-builder** | Social/Email/Image Studios, composers | Refuses to send live email/social unless safety toggles allow |
| **ui-jarvis-designer** | Visual polish, spacing, empty states, dark/light | Refuses backend logic unless a visual bug requires a prop fix |
| **release-reporter** | Sprint reports | Refuses to report on unshipped sprints |
| **smoke-verifier** | Automated page walks, API probes, deployment checks | Refuses to edit application code |
| **data-cleaner** | Test artifact cleanup | DRY RUN by default. Refuses to delete real production data |

## Operating rules

1. **No agent edits files outside its boundary** without explicit instruction.
2. **Chief Integrator** is the entry point for multi-track sprints.
3. **Smoke Verifier** runs after every sprint, before the release report.
4. All agents use the same Supabase client patterns, the same theme system,
   and the same component library in `components/ui/`.
5. Every agent commits with a `[SECTION]` prefix matching its domain.

## Adding a new agent

Create a `.md` file in `.claude/agents/` following the pattern of existing
agents. Define: name, description, owned surfaces, tools available, refusal
rules.

# DeepSeek/OpenCode Prompt

You are DeepSeek/OpenCode auditing the clean `LegendsOSv2.0` repository.

Your job is not to patch the old v1 system.

Your job is to audit the v2 build plan and implementation against the clean architecture.

Read:

- 00_AI_CEO_MODE.md
- 01_SOURCE_OF_TRUTH.md
- 02_ARCHITECTURE.md
- 04_DATA_MODEL.md
- 05_AI_PROVIDER_GATEWAY.md
- 06_N8N_AUTOMATION_PLAN.md
- 07_SECURITY_AND_APPROVALS.md
- 10_ACCEPTANCE_CRITERIA.md

Audit for:

- v1 architecture leakage
- Docker or Cloudflare dependency
- fake modules
- scope creep
- Supabase schema gaps
- RLS gaps
- AI provider security gaps
- n8n webhook security gaps
- role visibility problems
- broken acceptance criteria

Create:

- docs/deepseek-audit/AUDIT_VERDICT.md
- docs/deepseek-audit/RISK_LOG.md
- docs/deepseek-audit/FIX_PLAN.md
- docs/deepseek-audit/DO_NOT_BUILD_WARNINGS.md

Do not modify production code unless explicitly asked.

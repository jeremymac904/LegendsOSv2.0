# LegendsOS — Research

## AI provider landscape (as of 2026-06)

| Provider | Status in LegendsOS | Notes |
|---|---|---|
| OpenRouter | Primary text | Multi-model gateway, used for Atlas + agents |
| DeepSeek | Secondary text | Cost-effective for routine tasks |
| NVIDIA | Tertiary text | Used for specific model access |
| Fal.ai | Primary image | Fast image generation |
| HuggingFace | Configured but unused | Token present, no gateway routing |
| MiniMax | Wired but unconfigured | Full code path exists, no env vars |

## Integration options investigated

| Integration | Finding |
|---|---|
| Zapier MCP | Explored as social publishing path. MCP protocol saves URLs but runtime client not implemented. Wizard UI built. |
| Meta Graph API | Stub created. Requires App Review for production publishing permissions. |
| Google OAuth | Requires Google Cloud project with OAuth consent screen. Not yet configured. |
| n8n | Working. Webhook dispatch for social + email publish. HMAC callback verification implemented. |
| Knowledge embeddings | Requires vector extension (pgvector) or external service. Currently keyword-only. |

## Architecture patterns evaluated

| Pattern | Decision |
|---|---|
| Single AI runtime | Recommended but deferred (ADR-001) |
| Shared connection component | Recommended but deferred (audit recommendation #4) |
| In-page tab navigation | Adopted — AdminNav, SettingsNav, AcademyNav |
| GOAT API separation | Fenced with README; full separation deferred |

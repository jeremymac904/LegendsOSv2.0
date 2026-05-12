# LegendsOS v2.0 Source of Truth

## What LegendsOS v2.0 is

LegendsOS v2.0 is a unified internal AI operating system for Jeremy McDonald and the Legends Mortgage Team.

It is not a patched Onyx shell.

It is not a Docker experiment.

It is not a Cloudflare tunnel dependency.

It is not a collection of subdomain studios.

It is one normal web app.

## Stack

Use:

- Next.js
- TypeScript
- Tailwind
- Supabase Auth
- Supabase Postgres
- Supabase Storage
- Supabase Edge Functions only if needed
- Netlify hosting
- n8n for automations
- OpenRouter for general LLM routing
- DeepSeek for coding and reasoning where useful
- NVIDIA where useful for models or hosted inference
- Fal.ai for image generation
- Postiz only as a backend scheduling integration if useful

Do not use:

- Docker as required runtime
- Cloudflare as required runtime
- Onyx as app shell
- injected shell scripts
- subdomain studios
- Gemini as the required image provider
- ElevenLabs unless Jeremy later asks for voice
- Blog Studio
- LoanFlow
- Mortgage Ops
- Borrower Portal
- Realtor Portal
- Public Intake

## Core modules

### 1. Command Center

Home dashboard after login.

Shows:

- Welcome
- Quick launch cards
- Recent activity
- Drafts or pending items
- Usage summary for Jeremy
- Team alerts
- Connected app status

### 2. Atlas Chat

Hermes style agent chat.

Must support:

- Chat with Jeremy's Atlas agent
- Chat history
- File upload
- Screenshot upload
- Mortgage knowledge context
- Source grounded responses
- Team member role based agent access
- Logging usage events

Important role rule:

Regular team members should only see their own assistant and shared company assistants. Jeremy may see admin level controls and team wide views.

### 3. Social Studio

Unified social content workspace.

Must support:

- Create post
- Generate post copy
- Generate image
- Save drafts
- Schedule or send to n8n/Postiz workflow
- Platform targets:
  - Facebook
  - Instagram
  - Google Business Profile
  - YouTube
- Status tracking

### 4. Image Generation Studio

Uses Fal.ai as primary image provider.

May use OpenRouter or other models for prompt improvement.

Must support:

- Prompt entry
- Brand presets
- Mortgage campaign types
- Image generation
- Save image to Supabase Storage
- Attach image to social draft
- Track cost and usage
- Admin provider status

### 5. Email Studio

Must support:

- Newsletter draft generation
- Recipient list selection
- Template management
- Draft preview
- Approval before send
- Gmail/MailerLite/n8n integration options
- Status tracking

### 6. Calendar

Must support:

- Calendar view
- Meeting and event context
- Optional Google Calendar integration
- Content planning calendar
- Scheduled posts and newsletters

### 7. Admin and Usage Tracking

Jeremy view.

Must support:

- User list
- Role management
- Logins
- Message counts
- Image generation counts
- Social post counts
- Email draft/send counts
- Last active time
- Module usage
- Provider cost tracking

### 8. Settings and Integrations

Must support:

- API key configuration status
- Provider enable/disable
- n8n webhook URLs
- Postiz connection status
- User profile
- Team settings

## Design direction

Premium, dark, cinematic, practical.

Brand:

- Black
- Deep navy
- Orange/gold accent
- White text
- Clean cards
- No clutter
- No fake modules
- No empty rails
- No duplicate navigation
- No raw third party UI as primary experience

## Absolute rule

If a feature does not work, do not fake it.

Show:

- Not configured
- Needs API key
- Draft only
- Connected
- Disabled

No lies in the UI.

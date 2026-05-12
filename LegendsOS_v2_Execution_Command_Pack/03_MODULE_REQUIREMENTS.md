# Module Requirements

## Command Center

Routes:

- `/dashboard`

Features:

- quick launch cards
- recent work
- team usage snapshot for owner
- provider status
- drafts requiring approval
- upcoming scheduled content
- system health

Acceptance:

- No fake modules
- No broken cards
- No empty rails
- Every card links to a working route

## Atlas Chat

Routes:

- `/atlas`
- `/atlas/:sessionId`

Features:

- Hermes style chat interface
- source grounded assistant behavior
- screenshot upload
- file upload
- chat history
- session title
- owner visibility controls
- usage logging

Acceptance:

- Regular user sees only their own assistant and shared assistants
- Jeremy can view admin controls
- Upload works or shows clear disabled state
- No duplicate chat inputs
- No agent selection clutter

## Social Studio

Routes:

- `/social`
- `/social/drafts`
- `/social/calendar`

Features:

- create post
- generate copy
- attach generated image
- select channels
- save draft
- schedule via n8n/Postiz
- approval status

Channels:

- Facebook
- Instagram
- Google Business Profile
- YouTube

Acceptance:

- No raw Postiz screen as primary UI
- Every post has status
- Posting requires explicit confirmation
- Failed publish shows reason

## Image Studio

Routes:

- `/images`
- `/images/library`

Features:

- prompt
- brand preset
- campaign type
- aspect ratio
- model/provider status
- generate image through Fal.ai
- save to library
- attach to social draft
- usage and cost tracking

Acceptance:

- If Fal key missing, UI says key missing
- If generated, file is saved to storage
- Usage event is written
- Cost cap is enforced

## Email Studio

Routes:

- `/email`
- `/email/drafts`
- `/email/templates`

Features:

- newsletter draft
- AI copy generation
- templates
- recipient list
- approval before send
- n8n or MailerLite integration later

Acceptance:

- No send without approval
- Drafts save
- User can preview
- Owner can see activity

## Calendar

Routes:

- `/calendar`

Features:

- planned social posts
- planned emails
- meetings
- content calendar
- filters

Acceptance:

- Calendar loads fast
- No broken Google dependency
- Integration status visible

## Admin

Routes:

- `/admin`
- `/admin/users`
- `/admin/usage`
- `/admin/providers`

Features:

- users
- roles
- usage
- provider status
- cost caps
- audit log

Acceptance:

- Owner only
- RLS enforced
- No sensitive keys shown

## Settings

Routes:

- `/settings`

Features:

- profile
- integrations
- API key status
- n8n webhook status
- Postiz status
- team preferences

Acceptance:

- Never reveal full secrets
- Key status only
- User settings persist

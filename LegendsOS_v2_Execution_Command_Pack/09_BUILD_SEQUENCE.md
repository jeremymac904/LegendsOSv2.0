# Build Sequence

## Phase 0: Repo and project setup

Deliverables:

- clean Next.js app
- Tailwind configured
- Supabase client
- environment example
- Netlify config
- README
- source docs loaded

Acceptance:

- app runs locally
- pushed to LegendsOSv2.0 GitHub
- no Docker required
- no Cloudflare required

## Phase 1: Auth and layout

Deliverables:

- Supabase Auth
- profiles table
- roles
- dashboard shell
- sidebar
- protected routes

Acceptance:

- login works
- logout works
- owner/admin/loan officer roles work
- unauthenticated user redirected

## Phase 2: Atlas Chat

Deliverables:

- agents table
- chat sessions
- messages
- chat UI
- screenshot upload UI
- file upload to Supabase Storage
- OpenRouter text gateway

Acceptance:

- user can create chat
- messages save
- screenshot uploads
- usage logs

## Phase 3: Image Studio

Deliverables:

- Fal.ai gateway
- image form
- generated image storage
- library
- cost cap

Acceptance:

- missing key shows clear status
- configured key generates image
- image saves
- usage logs

## Phase 4: Social Studio

Deliverables:

- social_posts table
- draft editor
- attach image
- channel selection
- n8n webhook integration
- publish approval gate

Acceptance:

- draft saves
- schedule request writes status
- n8n webhook response stored
- no publish without confirmation

## Phase 5: Email Studio

Deliverables:

- email_drafts table
- template system
- draft generator
- preview
- approval gate
- n8n/MailerLite/Gmail integration placeholder or working connector

Acceptance:

- draft saves
- preview works
- send requires approval

## Phase 6: Calendar

Deliverables:

- calendar view
- scheduled social posts
- scheduled email drafts
- content planning items

Acceptance:

- events load
- posts and emails appear by date

## Phase 7: Admin and usage

Deliverables:

- usage_events table
- admin usage dashboard
- provider status
- user management
- audit logs

Acceptance:

- Jeremy can see usage
- regular users cannot see admin
- events recorded across modules

## Phase 8: QA and launch

Deliverables:

- Playwright smoke tests
- module checklist
- launch report
- rollback plan
- Netlify deployment

Acceptance:

- all core routes pass
- no fake modules
- no v1 dependencies
- team can test

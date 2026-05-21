# LF Resources

Route: `/lf-resources`

Purpose: a clean Loan Factory directory for training, LO support, development,
coaching, departments, system links, forms, setup resources, escalation
resources, feedback, and AI training.

## Required sections

- Loan Factory Training
- Loan Officer Support
- LO Development
- Corporate Coaching
- Training Academy
- Marketing Department
- Loan Factory System Links
- Important Forms
- n8n and LegendsOS Setup
- Google Workspace Setup
- Lender Escalation Resources
- Post Onboarding Check In
- Department Feedback
- AI Training Resources

## Data model

The page uses the existing `shared_resources` table with
`resource_type = 'lf_resource'`.

Payload fields used by the UI:

- `category`
- `url`
- `resource_type`
- `department`
- `tags`
- `audience`
- `format`
- `instructions`
- `detail`

Owners can add official links from the page. Loan officers can search, filter,
open internal detail pages, read notes, and open source resources in a new tab
when a source URL exists.

## Detail routes

Each resource opens an internal guide at `/lf-resources/[resourceId]`. The
internal guide explains what the resource is, who should use it, when to use it,
what is included, how to use it, and the next best action. External Drive links
are secondary source actions instead of the primary user experience.

## Google Drive source

The provided top-level Drive folder is included as a default resource:

<https://drive.google.com/drive/folders/164oRV4Vn1XRh6UTySL52USyXDugfQp6a?usp=sharing>

This sprint did not directly read the Drive folder through a connector. The UI
keeps the provided folder as a top-level source link and seeds internal resource
guides so Jeremy can curate approved private links into team-shared LF
resources.

## Help Coach

The LegendsOS Setup Coach appears on this page for LegendsOS, n8n, Google
Workspace, MCP, approved social account, and AI provider setup help.

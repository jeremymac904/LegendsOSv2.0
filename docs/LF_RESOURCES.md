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

Owners can add official links from the page. Loan officers can search, filter,
read notes, and open resources in a new tab.

## Google Drive source

The provided top-level Drive folder is included as a default resource:

<https://drive.google.com/drive/folders/164oRV4Vn1XRh6UTySL52USyXDugfQp6a?usp=sharing>

The Google Drive connector was able to list the folder and identify source
folders/files such as Training Knowledge, Marketing & Recruiting Project
Folder, Loan Factory team directory files, LO Development Docs, AI Loan
Placement HelpDesk, and AI Training Roadmap. Jeremy can curate more links from
that source into team-shared LF resources.

## Help Coach

The LegendsOS Setup Coach appears on this page for LegendsOS, n8n, Google
Workspace, MCP, approved social account, and AI provider setup help.

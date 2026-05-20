# Training Page

Route: `/training`

Purpose: a team-facing training command center for LegendsOS basics, Atlas
training, n8n setup, Google Workspace, social media, Image Studio, email
newsletters, mortgage coaching, sales coaching, Loan Factory systems, and AI
tools.

## Data model

The page uses the existing `shared_resources` table with
`resource_type = 'training_item'`.

Training payload fields:

- `category`
- `url`
- `video_url`
- `embed_url`
- `thumbnail_url`
- `duration_minutes`
- `audience`
- `tags`
- `format`
- `instructions`

Owners can add team-shared training records from the page. Loan officers can
search, filter, view details, open source links, and watch safe YouTube embeds.

## Video behavior

YouTube watch, short, live, and youtu.be URLs are converted to
`https://www.youtube.com/embed/...`. Arbitrary iframe HTML is not accepted.
Drive videos and documents open in a new tab with `rel="noopener noreferrer"`.

## Source context

The page includes default links from Jeremy's Loan Factory Drive source,
including the top-level Loan Factory Training Folder and Training Knowledge
folder. Jeremy can add individual videos from that folder as training items.

## Help Coach

The LegendsOS Setup Coach appears on this page for setup and training questions
around LegendsOS, n8n, Google Workspace, MCP, approved social accounts, and AI
provider basics.

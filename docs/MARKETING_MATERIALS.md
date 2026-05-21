# Marketing Materials

Route: `/marketing-materials`

Purpose: a team-facing library of customizable mortgage marketing templates and
campaign assets for loan officers.

## Included material areas

- Webinar templates
- First time homebuyer guides
- Real estate agent guides
- YouTube and podcast topic templates
- First time homebuyer seminar materials
- Real estate AI seminar materials
- Buyer education handouts
- Realtor co-branded campaign templates
- Email newsletter templates
- Social campaign packs
- Open house materials
- Listing marketing support
- Presentation outlines
- Script templates

## Data model

The page uses the existing `shared_resources` table with
`resource_type = 'marketing_material'`.

Payload fields used by the UI:

- `category`
- `resource_type`
- `url`
- `format`
- `audience`
- `tags`
- `instructions`
- `intended_use`
- `thumbnail_url`
- `detail`

Owners can add materials from the page. Loan officers can search, filter, open
internal detail pages, open source files, and copy usage instructions.

## Detail routes

Each material opens a finished internal page at
`/marketing-materials/[materialId]`. The detail page includes intended
audience, use case, included assets, customization instructions, copy guidance,
download/source links when present, related templates, and next steps.

Starter content now includes first-time homebuyer webinar material, first-time
homebuyer guide, real estate agent guide, Real Estate AI seminar material,
YouTube/podcast topics, monthly newsletter, realtor co-branded social campaign
pack, open house material, buyer education handout, presentation outline, and
script templates.

## Editing scope

This sprint does not add a full document editor. Each material provides the
minimum useful workflow: use the template, customize it, copy instructions, and
open or download the source file when one exists.

## Help Coach

The LegendsOS Marketing Image Coach appears on this page for planning mortgage
marketing visuals, preparing reference photos, writing Image Studio prompts,
and keeping campaign imagery mortgage safe.

# LegendsOS — Gmail AI Intake (n8n workflows)

Importable n8n workflow JSON for the LegendsOS Gmail AI Intake system (Phase 1).

> **Every workflow in this folder ships `"active": false`.** Nothing runs until a
> human reviews it, attaches credentials, and turns it on in n8n. Importing these
> files does **not** start watching any mailbox.

## Phase 1 safety guarantees (built into the nodes, not just docs)

These workflows are **record + queue for human review only**. They:

- **Never** send a customer-facing reply or any email
- **Never** delete, archive, or trash a message
- **Never** mark a message as read or modify labels (the Gmail Trigger only
  *watches* — it has no modify/markRead operation)
- **Never** write to a borrower folder — unmatched attachments go to a single
  Google Drive **"Needs Review"** folder only
- **Never** print or hardcode secrets — the webhook secret and base URL come from
  n8n credentials / environment expressions

## Files (13 workflows)

### Per-person Gmail intake (11)
One per team member. Each: **Gmail Trigger (read-only)** → **Build Intake Payload**
(Set) → **POST `/api/webhooks/email-intake`** (HTTP), plus an **IF (Has
Attachments?)** branch that POSTs to **`/api/webhooks/document-intake`** when the
message has attachments (the no-attachment branch is a NoOp).

| File | Team member | Gmail | Status |
| --- | --- | --- | --- |
| `gmail-intake-jeremy.json` | Jeremy McDonald | jeremy@mcdonald-mtg.com | confirmed |
| `gmail-intake-ashley.json` | Ashley Rogers | — | **address needed** |
| `gmail-intake-geraldine.json` | Geraldine | — | **address needed** |
| `gmail-intake-hugo.json` | Hugo Calvillo | hugo.calvillo@loanfactory.com | confirmed |
| `gmail-intake-eric.json` | Eric Ritchie | eric.ritchie@loanfactory.com | confirmed |
| `gmail-intake-raleigh.json` | Raleigh | — | **address needed** |
| `gmail-intake-barbara.json` | Barbara | — | **address needed** |
| `gmail-intake-bryan.json` | Bryan Payne | bryan.payne@loanfactory.com | confirmed |
| `gmail-intake-scott.json` | Scott Mason | scott.mason@loanfactory.com | confirmed |
| `gmail-intake-jared.json` | Jared Goldfarb | jared.goldfarb@loanfactory.com | confirmed |
| `gmail-intake-brandon.json` | Brandon Ingram | brandon.ingram@loanfactory.com | confirmed |

For the four members whose address is **not yet confirmed**, the workflow's
`source_account` is the literal placeholder `SET_IN_N8N`. The owner confirms the
real address in `/email-intake/settings`, then sets it in the Gmail credential
and updates `source_account` in the **Build Intake Payload** node.

### Shared routers (2)
| File | Purpose |
| --- | --- |
| `shared-alert-router.json` | Receives an **approved** internal alert (a human already approved it in LegendsOS) and routes it to the **internal channel only** (in-app / internal HTTP). Never an external customer reply. |
| `attachment-needs-review-router.json` | Uploads an **UNKNOWN / unmatched** attachment to the Google Drive **"Needs Review"** folder **only**, then POSTs metadata to `/api/webhooks/document-intake`. Never writes to a borrower folder. |

## Import steps

1. In n8n: **Workflows → Import from File** (repeat for each `.json`), or use the
   n8n CLI: `n8n import:workflow --input=gmail-intake-jeremy.json`.
2. Every imported workflow arrives **inactive**. Leave it inactive until setup +
   review are complete.

## One-time n8n setup

### 1. Environment variables (n8n host / `.env`)
- `LEGENDSOS_WEBHOOK_BASE_URL` — base URL of the LegendsOS app, e.g.
  `https://legendsos.app`. Referenced as `={{ $env.LEGENDSOS_WEBHOOK_BASE_URL }}`.
- `LEGENDSOS_NEEDS_REVIEW_FOLDER_ID` — the Google Drive folder id of the single
  "Needs Review" folder (used by `attachment-needs-review-router.json`).
  Referenced as `={{ $env.LEGENDSOS_NEEDS_REVIEW_FOLDER_ID }}`. If you prefer, you
  can instead hardcode the folder id directly in the Google Drive node's
  `folderId` field (it currently shows the placeholder `SET_IN_N8N`).

### 2. Webhook secret (Header Auth credential)
Create an n8n **Header Auth** credential named exactly
**`LegendsOS Webhook Secret`**:
- **Name:** `x-legendsos-webhook-secret`
- **Value:** the value of the server's `LEGENDSOS_WEBHOOK_SECRET`

This credential is referenced by every HTTP Request node (and the inbound webhook
nodes on the two routers). The secret value lives **only** in this credential —
it is never written into any workflow JSON. Anywhere a credential reference is not
expressible, the JSON contains the literal placeholder `SET_IN_N8N`, which you
replace by selecting the real credential in the n8n UI.

### 3. Per-mailbox Gmail credentials
Each per-person workflow's Gmail Trigger references a Gmail OAuth2 credential
named `Gmail — <Name> (intake, read-only)` with id `SET_IN_N8N`. For each
workflow:
1. Connect / select that team member's Gmail (or Workspace) mailbox as a Gmail
   OAuth2 credential.
2. Use a scope that allows **reading** mail. Do **not** grant send/modify if your
   setup lets you scope it down — these workflows never send or modify.
3. Attach the credential to the **Gmail Trigger (read-only)** node.

### 4. Google Drive credential (Needs Review router only)
`attachment-needs-review-router.json` references a Google Drive credential named
`Google Drive — LegendsOS Needs Review` (id `SET_IN_N8N`). Connect an account that
has write access **only** to the "Needs Review" folder/shared drive. Set the
folder id via `LEGENDSOS_NEEDS_REVIEW_FOLDER_ID` (above).

## Placeholder reference

| Placeholder | Where | Replace with |
| --- | --- | --- |
| `SET_IN_N8N` (credential `id`) | every node with `credentials` | select the real credential in the n8n UI |
| `SET_IN_N8N` (`source_account`) | Build Intake Payload, on unconfirmed members | the member's confirmed Gmail address |
| `SET_IN_N8N` (Drive `folderId`) | Needs Review router | the "Needs Review" folder id (or set `LEGENDSOS_NEEDS_REVIEW_FOLDER_ID`) |
| `={{ $env.LEGENDSOS_WEBHOOK_BASE_URL }}` | HTTP nodes | n8n env var |
| `={{ $env.LEGENDSOS_NEEDS_REVIEW_FOLDER_ID }}` | Drive node | n8n env var |

## Going live (per workflow)

1. Import the file.
2. Attach the Gmail credential (and Drive credential where applicable).
3. Attach the **LegendsOS Webhook Secret** Header Auth credential to the HTTP /
   webhook nodes.
4. Confirm `LEGENDSOS_WEBHOOK_BASE_URL` (and folder id) are set.
5. Review the wiring, then toggle the workflow **Active** in n8n.

Until step 5, the workflow does nothing.

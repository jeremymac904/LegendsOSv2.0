# Acceptance Criteria

## Global

- App runs as a unified web app.
- No Docker required for app runtime.
- No Cloudflare required for app runtime.
- No injected shell.
- No subdomain studios.
- No Onyx visible UI.
- No broken or fake modules.
- No duplicate navigation.
- No hidden old app stacked under new UI.

## Auth

- Supabase Auth works.
- Role based access works.
- Jeremy is owner.
- Regular team member cannot access admin.

## Atlas

- User can start a chat.
- User can send a message.
- Assistant responds.
- Chat history persists.
- Screenshot upload appears once only.
- Uploaded file metadata saves.
- Regular user sees own assistant, not all team assistants.

## Image Studio

- Provider status visible.
- Missing key state is clear.
- Fal generation works when key is configured.
- Images save to Supabase Storage.
- Usage event writes.
- Daily cap enforced.

## Social Studio

- User can create social draft.
- User can attach generated image.
- User can select Facebook, Instagram, Google Business Profile, YouTube.
- User can send schedule request through n8n.
- Status updates after n8n response.
- No raw Postiz as primary UI.

## Email Studio

- User can create newsletter draft.
- User can generate copy.
- User can preview.
- Send requires approval.
- Draft saves.

## Calendar

- Calendar loads.
- Scheduled posts appear.
- Scheduled emails appear.
- User can create planning item.

## Admin

- Jeremy can view team usage.
- Login count tracked.
- Message count tracked.
- Image count tracked.
- Social draft/publish count tracked.
- Last active tracked.
- Provider status visible.

## QA

- Playwright validates all major pages.
- Console has no critical errors.
- Loading states exist.
- Error states are friendly.
- Mobile basic layout works.

# Google Workspace Credentials

This covers connecting Gmail, Calendar, Drive, Sheets, Contacts, and Docs to n8n.

## Before you start

- You need a Legends-approved Google account. Personal Gmail (`@gmail.com`) is OK for your own LO mailbox; team domains depend on what Jeremy assigned.
- You need browser access to https://loanfactoryai.app.n8n.cloud while signed into the Google account you're connecting.
- You do **not** need to download anything.

## General flow (works the same for every Google tool)

1. Open n8n → **Credentials** → **Create Credential**.
2. Type the tool name into the search (e.g. *Gmail*).
3. Pick the **OAuth2** variant (e.g. *Gmail OAuth2 API*).
4. n8n shows a "Sign in with Google" button.
5. Click it. A Google consent screen pops up.
6. Pick the right Google account.
7. Approve the requested scopes (Gmail will ask for "read and send email", Calendar for "manage your calendar", etc.).
8. The popup closes. n8n shows the credential as connected.
9. Click **Save**.

## Per-tool notes

### Gmail OAuth2 API
- Scope: read + send.
- After connect, the credential should be named something Jeremy can recognize, like *Gmail — yourname*. Default is fine; only rename if Jeremy asks.

### Google Calendar OAuth2 API
- Scope: read + write calendar events.
- Used for scheduling content reminders and team calendar items.

### Google Drive OAuth2 API
- Scope: file read + write inside Drive folders you grant access to.
- Used for asset and document workflows.

### Google Sheets OAuth2 API
- Scope: spreadsheet read + write.
- Used for lead tracking, audit logs, and content calendars.

### Google Sheets Trigger OAuth2 API
- Same connection style as Sheets, but n8n uses this for **trigger** nodes.
- You may be asked to connect both Sheets and Sheets Trigger.

### Google Docs OAuth2 API
- Scope: read + write Docs.
- Used to draft long-form documents from chat.

### Google Contacts OAuth2 API
- Scope: read contacts.
- Used to pull personal CRM-style contact lists. Optional.

## When something fails

- **"Access blocked"** during consent: your Google account belongs to a workspace with admin restrictions. Ask your IT or Jeremy.
- **"Credential is invalid"** later: the OAuth token expired. Re-click "Sign in with Google" inside the credential and re-approve.
- **You connected the wrong account:** delete the credential, create a new one, and sign in with the right account. (Only delete credentials you yourself created.)

## Important rules

- ✋ Never paste your Google password into chat — anywhere. Google's OAuth flow handles that on Google's own site.
- ✋ Never email or DM the n8n credential ID or token to anyone.
- ✅ If Jeremy ever asks "is X connected?" answer with the green/red status only.

## Done?

When all six credentials show green, ping Jeremy: "Google Workspace connected."

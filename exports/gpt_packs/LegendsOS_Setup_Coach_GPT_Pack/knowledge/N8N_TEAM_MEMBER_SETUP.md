# n8n Team Member Setup

The Legends team uses n8n for automation. Loan officers get a **read +
credential-create** seat, not a workflow editor seat.

## Your n8n account

- **Instance URL:** https://loanfactoryai.app.n8n.cloud
- **Sign in:** with the email Jeremy invited you under.
- If you can't log in, do **not** sign up again. Ask Jeremy to re-invite you.

## What you actually do in n8n

You connect credentials. That's it. Specifically:

1. Click **Credentials** in the left sidebar (not Workflows).
2. Click **Create Credential**.
3. Find the credential type Jeremy assigned (e.g. *Gmail OAuth2 API*, *Google Sheets OAuth2 API*).
4. Click the credential, then click **Sign in with Google** (or *Sign in with Meta* for Facebook / Instagram).
5. Approve the consent screen. You are now connected.
6. Save. The credential will show a green dot when ready.

## What you do NOT do in n8n

- ❌ Do not open the **Workflows** tab and edit anything.
- ❌ Do not click **Activate** on any workflow.
- ❌ Do not delete or rename existing credentials (they may be linked to live workflows).
- ❌ Do not create a workflow from scratch.
- ❌ Do not paste API keys into chat with anyone.

If a workflow needs your credential, n8n will pick it up automatically once it's connected. You don't have to wire anything.

## Common credential types you might be asked to connect

| Credential type in n8n | What it is for |
|---|---|
| Gmail OAuth2 API | Sending and reading email |
| Google Calendar OAuth2 API | Calendar events |
| Google Drive OAuth2 API | File access |
| Google Sheets OAuth2 API | Spreadsheet read/write |
| Google Sheets Trigger OAuth2 API | Sheets-based trigger |
| Google Docs OAuth2 API | Document creation |
| Google Contacts OAuth2 API | Contact list |
| Google Business Profile OAuth2 API | GBP posts and reviews |
| Facebook Graph API | Facebook page access |
| Facebook Lead Ads OAuth2 API | Lead form intake |
| YouTube OAuth2 API | YouTube channel access |

If Jeremy asks you to connect something not in this table, double-check with him before you click anything.

## Confirming you're done

When all assigned credentials show **green**, message Jeremy: "n8n credentials connected." He'll do the workflow side.

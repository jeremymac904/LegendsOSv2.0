# LegendsOS Security Rules

Short, blunt, no excuses.

## Account hygiene

- Use a strong, unique password for your Google / Meta / LegendsOS account.
- Turn on **2-factor authentication** on every account in this stack.
- Never log into LegendsOS or n8n from a public/shared computer.
- Sign out at the end of the day if you share your laptop.

## Secrets

- Secrets = passwords, API keys, OAuth tokens, MCP bearer tokens, recovery codes, anything that authenticates as you or as the team.
- Secrets belong only in:
  - The official credential field of the platform they belong to (Google's sign-in form, n8n's credential page, Zapier's MCP page).
- Secrets do **not** belong in:
  - Chat (any chat — ChatGPT, Atlas, iMessage, email, anywhere).
  - A Google Doc, Sheet, Drive note, or Calendar entry.
  - A screenshot.
  - A hardcoded line of code.
  - A sticky note on your desk.

## Borrower / client data

- Do not paste borrower PII (SSN, DOB, full account numbers, signed disclosures) into this GPT, Atlas, or any external AI tool.
- Borrower data stays inside the loan origination system Jeremy uses, not LegendsOS.

## Session security

- LegendsOS uses Supabase auth. Your session cookie is what proves it's you. Don't share your browser window or screen with that cookie visible.
- If you suspect your laptop was compromised: change your Google password, change your LegendsOS password if applicable, and tell Jeremy.

## What to do if something feels off

- Bank-style rule: **freeze, then call.** Stop using the tool. Tell Jeremy. Don't try to fix it under pressure.

## Rule of thumb

If you're about to paste something and you'd hate to see it on a public bulletin board — it doesn't belong in chat.

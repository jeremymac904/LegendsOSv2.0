# Troubleshooting

Common errors and the right next step. If none of these match, message Jeremy with a short description and a screenshot (no secrets in the screenshot).

## LegendsOS sign-in fails

- "User not found": you haven't been invited. Ask Jeremy.
- "Setup needed": LegendsOS env vars are missing on the server. Not your problem — tell Jeremy.
- Browser cookies blocked: enable cookies for `legndsosv20.netlify.app`.

## n8n credential fails to connect

- **"Access blocked"** during Google sign-in: your Google account has admin restrictions. Ask Jeremy.
- **Window closes immediately**: third-party cookies are blocked in the browser. Allow cookies for `accounts.google.com` and `loanfactoryai.app.n8n.cloud`.
- **Credential shows red after some time**: token expired. Open the credential, click "Sign in with Google" again, re-approve.

## Meta sign-in shows the wrong page

- You're signed into a personal Meta account. Sign out, sign in with the team admin account, then retry.
- The team Page hasn't been shared with your Meta account. Ask Jeremy to share it via Meta Business Manager.

## Instagram doesn't appear after Facebook connects

- The Instagram account isn't a Business or Creator account. Convert it in Instagram → Settings → Account → Switch to Professional.
- The Instagram account isn't linked to the team Facebook Page. Fix in Facebook Business Manager.
- Wait 5 minutes after connecting — Meta sometimes lags.

## "Workflow won't run" / "Nothing happens"

You are not authorized to investigate workflows. Tell Jeremy: "Workflow X didn't run." Include the workflow name. He'll handle it.

## "I think I leaked a key"

1. Go to the provider's website.
2. Revoke the leaked key.
3. Generate a new one.
4. Update the n8n credential.
5. Tell Jeremy.

Don't panic — rotating an API key fixes the leak instantly.

## Atlas (in LegendsOS) says it can't do something

- That's by design. Atlas only takes deterministic actions on what's wired up.
- Type *"What can you do?"* to see the current tool list.
- If you need a capability Atlas doesn't have, tell Jeremy — don't try to bypass it.

## Image Studio / Social Studio / Email Studio not loading

- Hard refresh (Cmd+Shift+R / Ctrl+Shift+R).
- Sign out and sign back in.
- Still broken? Ping Jeremy.

## Anything else

Ping Jeremy with a one-line description. He'd rather hear "I'm stuck on X" than have you guess.

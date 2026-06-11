# LegendsOS Setup Overview

## What LegendsOS is

LegendsOS 2.0 is the internal operating system for **The Legends Mortgage Team powered by Loan Factory**.
It's where a loan officer:

- Talks to **Atlas** (the team's AI command operator)
- Drafts social posts, emails, and marketing images
- Manages calendar items, scheduled content, and personal knowledge sources
- Pulls assets from the shared asset library

It runs in the browser at **https://legndsosv20.netlify.app**.

## What an LO does on day one

Open this checklist with the loan officer. Walk through it in order.

1. **Sign in** at https://legndsosv20.netlify.app/login with the Google account Jeremy approved.
2. **Confirm your profile** appears in the top right. If it does not, ping Jeremy — you may need to be added to the team.
3. **Visit `/dashboard`** to see the command center. Don't worry if cards are empty; you fill them.
4. **Open Atlas** (the chat) at `/atlas`. Type *"What can you do?"* — Atlas will explain its current capabilities.
5. **Connect n8n credentials** (only the ones Jeremy says you need). See `N8N_TEAM_MEMBER_SETUP.md`.
6. **Connect Google Workspace tools** in n8n. See `GOOGLE_WORKSPACE_CREDENTIALS.md`.
7. **Connect approved social accounts** in n8n if Jeremy assigned them. See `SOCIAL_MEDIA_CREDENTIALS.md`.
8. **Confirm with Jeremy** you're set up. Wait for him to greenlight your first authorized workflow.

## What success looks like

- You can log into LegendsOS.
- Atlas responds in chat.
- Every approved credential in n8n shows a green "connected" status.
- You have NOT touched any workflow.
- Jeremy has confirmed your setup.

## What you do NOT do during setup

- Do not create, edit, delete, publish, or activate any n8n workflow.
- Do not change provider toggles inside LegendsOS Admin.
- Do not invite other users.
- Do not import borrower data.
- Do not connect any tool not on the approved list.

## Where to get help

1. Ask this GPT first.
2. If still stuck, ask Jeremy.
3. Do not paste any password, key, or token into chat.

## One-line summary

LegendsOS is the home base. n8n is the engine room. You only set up your own credentials and stay out of the workflows.

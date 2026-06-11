# Social Media Credentials

Connect Facebook, Instagram (through Meta), Google Business Profile, and YouTube — only if Jeremy assigned them to you.

## Before you start

- Be signed into the correct Meta or Google account in your browser before opening n8n. Switching mid-flow is the #1 cause of "wrong account connected" errors.
- The accounts you connect should be the **team's** approved page/profile, not a personal social account, unless Jeremy explicitly says otherwise.
- Do **not** connect personal accounts to a team workflow without Jeremy's go-ahead.

## Facebook (Facebook Graph API)

1. n8n → Credentials → Create Credential.
2. Search **Facebook Graph API**.
3. Click **Sign in with Facebook**.
4. Pick the team page when prompted.
5. Approve the requested permissions (page management, post drafting).
6. Save.

If Meta asks you to choose between multiple Pages, pick the one Jeremy assigned.

## Instagram (through Meta — uses Facebook Graph API)

Instagram for Business connects through Facebook. There is **no separate Instagram credential**.

1. Make sure the Instagram account is converted to **Business** or **Creator** in Instagram settings.
2. In Facebook Business Manager, the Instagram account must be linked to the team Facebook Page.
3. The Facebook Graph API credential (above) is what n8n uses.

If your Instagram doesn't show up in n8n drafts later, the Instagram-to-Page link is missing. Ask Jeremy.

## Facebook Lead Ads OAuth2 API

This is a separate credential from Facebook Graph API.

1. Credentials → Create Credential → **Facebook Lead Ads OAuth2 API**.
2. Sign in with the same Meta account.
3. Approve the Lead Ads read scope.
4. Save.

Used only if Jeremy is sending lead form data to LegendsOS.

## Google Business Profile OAuth2 API

1. Credentials → Create Credential → **Google Business Profile OAuth2 API**.
2. Sign in with the Google account that owns the Legends team's GBP listing.
3. Approve.
4. Save.

If you have multiple GBP locations, n8n will use the one tied to the signed-in account.

## YouTube OAuth2 API

1. Credentials → Create Credential → **YouTube OAuth2 API**.
2. Sign in with the Google account that owns the team's YouTube channel.
3. Approve the channel management scope.
4. Save.

Only connect this if Jeremy is publishing video content from LegendsOS.

## What you do NOT touch

- ❌ Don't post anything from n8n yourself. Live posting requires Jeremy's approval and a workflow toggle that only Jeremy flips.
- ❌ Don't change page admin roles in Meta Business Manager.
- ❌ Don't disconnect or rename existing credentials.

## Done?

Once all assigned social credentials are green, message Jeremy: "Social credentials connected."

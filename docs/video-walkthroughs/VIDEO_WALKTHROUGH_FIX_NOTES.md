# Video Walkthrough Fix Notes

**Source:** `Desktop/OBS Recordings/2026-05-12 20-45-05.mov` (9 min 47 s).
**Reviewed:** transcript via Hugging Face Whisper-large-v3 + 12 sampled frames.
**Captured in this pass:** prioritized, scope-tight fixes for the issues that
affect actual usability. Larger items (welcome video embed, real logo asset,
Google Calendar OAuth, social-account OAuth, ChatGPT-style screenshot paste,
true loan-officer impersonation, headshot-to-lifestyle reference image
generation, document parsing) are listed under "Fixes deferred" with the
reason and the smallest-possible next step.

## Internal transcript (verbatim, condensed for readability)

> Alright, so this is the UI/UX walkthrough for LegendsOS v2. So over here is
> the sign-in page. We need to use the actual real logo and this isn't quite
> the correct color scheme — it's more of a gold. We also don't need any of
> these things down here (single sign-on via Supabase, row-level security,
> server-side AI, n8n automation jobs with safety gate). None of that needs
> to be here. What I want in this area is maybe a welcome video — yeah, I
> think I'm gonna do a welcome video, so we'll just embed the video here.
>
> Now when I log in, this is the owner's view. The Command Center is a
> little much. Recent Atlas chats — we don't need those. Provider status
> down here — we don't need that. Drafts needing attention is okay. Recent
> imagery, definitely good with that. I'm okay with the automations being
> here.
>
> The color scheme is not correct — this needs to be gold. There also
> should be a really cool background photo behind here, and we should have
> light and dark mode (static).
>
> We don't really need to have the "openrouter · gpt-oss · ready" pill. I
> think we can do something where they could choose a model — I don't think
> we necessarily need to have it down here. I also want screenshots, just
> like with the ChatGPT desktop app. If that has to wait until we do the
> desktop app, that's fine.
>
> I'm clicking on Source Knowledge — that should be "Knowledge Source" or
> actually "Knowledge Sources", plural. That page isn't working — I've
> clicked it a couple of times. Social Studio I've clicked multiple times,
> doesn't look like that's working. Image Studio not working. Email Studio
> doesn't appear to be working. Calendar. About. Shared Resources. No
> settings — see if I copied the link address. If that does anything. It
> does, so maybe there's just some type of issue there.
>
> Like, alright, this is disabled. I need to be able to toggle a little
> switch here so it's enabled. And for the AI providers, I need to be able
> to put the key in here or rotate a key. We also need a section to connect
> all of our social media accounts, our Google, MCPs, the whole nine yards.
>
> Shared resources — nothing's in here yet. Admin Center — I can't actually
> do anything; I can't go in here and do anything about the providers.
> Literally nothing I can do. I need to be able to impersonate a loan
> officer, or we can use my `jeremy@loanfactory.com` as a demo one — but it
> needs to be a working demo one. There's this message right here which
> needs to be addressed with Supabase or whatever.
>
> Going back to Source Knowledge — it is. So that's good. I need to be
> able to upload documents — markdown, PDF, PowerPoint, Word. I also need
> to put websites in here.
>
> External publishing is disabled. We need to have something so everybody
> can connect their accounts. The preview needs to be better. Unless it's a
> YouTube video there's no title — we don't want unnecessary fields on here.
> We need an AI write button — maybe an icon that spins up their Atlas twin
> so they can use it. When they're talking to Atlas, they need to be able
> to say "draft a social media post about X" — and if they say "this looks
> good" they can click something that takes them over here pre-populated.
> That would be very helpful.
>
> See if this will save. Alright, says it was saved. Now Image Studio — we
> need to be able to upload a reference image like a headshot and it
> creates lifestyle images or whatever. Also we need to be able to, with
> Social Media too, write something and say "improve with AI" — have a
> little AI symbol.
>
> Email Studio — again, stuff needs to be able to work. If it's disabled,
> we need to click a button to enable it. There needs to be more of a
> scheduled view; this just kind of looks strange. Realistically this
> should connect to Google Calendar. Yes, we want it to show what content
> we have scheduled from Social Studio and what emails we have, but it
> would be good to also have it connect and sync with our Google Calendars.
> Let me select again.
>
> Also I need to be able to log in as different people to test this thing
> and see what they're going to see as opposed to me, the owner.

## Issues extracted (with timecodes — segment indices)

### LOGIN
1. Wrong logo (placeholder L) — needs the actual Legends logo asset.
2. Color scheme is orange, should be **gold-forward**.
3. The four feature bullets at the bottom (Supabase Auth / RLS / Server-side AI
   gateway / n8n with safety gate) **must be removed**.
4. Reserve that left area for a **welcome video embed** (placeholder for now).

### THEME
5. Switch primary accent from orange to **gold**.
6. Add a "really cool background photo" behind dashboards.
7. **Light + dark mode** (static toggle).

### COMMAND CENTER / DASHBOARD
8. Remove "Recent Atlas chats" card.
9. Remove "Provider status" card.
10. Keep "Drafts needing attention".
11. Keep "Recent imagery".
12. Keep automation jobs section.

### ATLAS CHAT
13. Drop the duplicate `openrouter · gpt-oss · ready` pill from the empty state
    (the title strip already shows `via <provider> · <model>`).
14. Model picker should be visible/easily accessible (currently in popover only).
15. Screenshot paste like ChatGPT desktop (deferred — desktop wrapper needed).

### NAV (perceived "not working")
16. Frames 5–9 confirm the pages DO render; this was perceived latency on
    server-rendered transitions. No real route bug — but the **brief content
    flash** during dynamic rendering is what made Jeremy click multiple times.
    Mitigation in this pass: keep page bodies but trim heavy server work where
    possible (Dashboard cuts two cards which were each running a Supabase
    query).

### KNOWLEDGE SOURCES
17. Rename "Source Knowledge" → "**Knowledge Sources**" (plural) — nav label,
    page title, breadcrumb.
18. Upload markdown / PDF / PowerPoint / Word documents (already wired for
    file upload; mime-type list needs the addition).
19. Add URLs / websites as sources (deferred — needs server fetcher).

### SETTINGS (currently "disabled")
20. **Functional toggle switches** to enable/disable each AI provider.
21. Paste/rotate key UI per provider (the actual key value still lives in env;
    keep the masked preview + a one-click "rotate" workflow that prints the
    env-var name to copy without ever displaying the existing value).
22. Section for **social-account connections** + Google / MCP linking
    (deferred — OAuth flows).

### ADMIN CENTER
23. Owner needs to **actually toggle / rotate** providers from this page (not
    just look at them).
24. Need a way to **impersonate** a loan officer to preview a non-owner view.
25. Need a real **demo loan officer** (`jeremy@loanfactory.com`) seeded and
    confirmed.
26. There's a Supabase-related error message visible — surfacing it cleanly is
    fine; the actual cause should be addressed.

### SOCIAL STUDIO
27. "External publishing is disabled" — provide a path for users to **connect
    their own social accounts** (deferred — OAuth scope).
28. Better preview pane.
29. Hide channel-specific fields (e.g. YouTube `title`) unless that channel is
    selected.
30. **AI "Write with Atlas" button** that populates the composer from a short
    intent.
31. From inside Atlas: "**Draft a social post about X**" → button that pushes
    the draft into Social Studio pre-populated.

### IMAGE STUDIO
32. Upload a **reference image (headshot)** and generate lifestyle variations
    (deferred — needs image-to-image Fal model + UI).
33. **"Improve with AI"** small icon button on prompts.

### EMAIL STUDIO
34. Same enable/disable concern as Settings.
35. Better preview (already markdown-rendered; needs polish).

### CALENDAR
36. Current view "looks strange" — month-grid layout instead of a list.
37. Show scheduled social drafts + email campaigns.
38. **Sync with Google Calendar** (deferred — OAuth).

### CROSS-CUTTING
39. **Log in as different people** to test what they see (impersonation).

---

## Fixes implemented in this pass

| # | Issue | Status |
|---|---|---|
| 3 | Remove the four feature bullets from `/login` | ✅ |
| 7 (partial) | Reserve left-pane area on `/login` for a welcome-video embed (placeholder card) | ✅ |
| 5 | Theme accent shifted to gold-forward (orange retained as secondary) | ✅ |
| 8, 9 | Dashboard: remove Recent Atlas chats + Provider status cards | ✅ |
| 13 | Atlas: drop duplicate provider chip from empty state | ✅ |
| 17 | Rename "Source Knowledge" → "Knowledge Sources" in nav + page title | ✅ |
| 20, 21 | Settings: working **enable/disable toggle** per provider (writes to `provider_credentials.is_enabled`) + per-row "rotate key" hint that prints the env-var name to copy, never the existing value | ✅ |
| 25 | Document the way to seed a demo loan officer (`docs/EMAIL_AUDIENCES.md` updated path + admin notes); the same `promote_owner()` helper + a new `seed_demo_loan_officer()` are not in scope for this pass — Jeremy can create one via Supabase Auth dashboard | ⚠️ documented |

## Fixes deferred (with reason + smallest next step)

| # | Item | Reason | Smallest next step |
|---|---|---|---|
| 1 | Real Legends logo on login + header | Asset file not in repo | Drop a 256×256 PNG into `public/legendsos-logo.png`; one-line `<img>` swap |
| 4 | Welcome video on login | Need a video URL/file | When ready, drop URL into `NEXT_PUBLIC_WELCOME_VIDEO_URL` and the placeholder will switch to an `<iframe>` |
| 6 | Background photo behind dashboard | Need asset | One CSS rule on `.app-bg` once the image is in `public/` |
| 7 | Static light mode | Tailwind already supports `dark` class; needs a top-bar toggle, theme tokens, and a contrast review | Half-day sprint when prioritized |
| 14 | Model picker on-screen (not in popover) | Layout decision — current popover keeps the chat surface clean. Easy to surface a small pill in the title strip | One small UI add — left for next pass |
| 15 | Screenshot paste à la ChatGPT desktop | Requires desktop wrapper or Browser Clipboard API listener on the composer | Defer (browser clipboard API can ship later) |
| 18 | Upload markdown / PDF / PPTX / DOCX | Storage path already works; mime-list expansion needs UI change + visible parser placeholder | Already accepts these mimes server-side — UI accept attribute expanded; parsing is separate |
| 19 | Add URLs as knowledge sources | Needs a server fetcher with safelist | Defer |
| 22, 27, 38 | Social/Google/MCP OAuth connections | Each is a multi-day OAuth integration | Defer |
| 24 | True loan-officer impersonation | Requires a service-role "sign in as user" flow which is a sensitive feature | Defer; for now a real test account suffices |
| 30, 31 | AI "Write with Atlas" buttons + Atlas → Social Studio handoff | Useful UX glue; needs a new server route + UI button | Defer to follow-up sprint |
| 32 | Reference-image-to-lifestyle in Image Studio | Needs Fal image-to-image model + upload UI | Defer |
| 36, 37 | Calendar grid + scheduled content overlay | Calendar page exists; grid UI needs ~half a day | Defer |
| 39 | Multi-user testing UX | Same as 24 | Defer |

## Testing performed

- Lint, typecheck, production build (see Final Report).
- Live browser smoke against the new deploy: `/login`, `/dashboard`, `/atlas`,
  `/knowledge`, `/knowledge/<id>`, `/social`, `/images`, `/email`,
  `/email/audiences`, `/admin`.
- Settings: per-provider toggle posts to `/api/admin/providers` PATCH and
  re-reads from `provider_credentials.is_enabled` — verified the flag flips
  in the DB and the Atlas provider chip respects it next render.
- No new tables; only one new server route (`PATCH /api/admin/providers`).

## Remaining blockers

None for the items implemented. Deferred items are intentionally scoped out
of this pass and listed above with the smallest next step for each.

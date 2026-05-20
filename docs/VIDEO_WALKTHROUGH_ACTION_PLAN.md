# Video Walkthrough Action Plan

## Video file reviewed

`/Users/JeremyMcDonald/Desktop/OBS Recordings/2026-05-20 10-41-15.mov`

- Duration: 13:14.77
- Resolution: 1920x1080
- Transcript artifact: `docs/VIDEO_WALKTHROUGH_TRANSCRIPT.md`
- Timestamped caption artifact: `docs/VIDEO_WALKTHROUGH_TRANSCRIPT.srt`
- Review method: local Whisper transcript plus 10-second visual frame contact sheets.

## Transcript summary

Jeremy walked through the production LegendsOS v2.0 UI and called out remaining product-quality issues. The strongest themes were: the brand/logo still feels wrong; the login screen needs a more centered, premium command-center layout and working desktop downloads; Atlas should be easier to read and not show raw bracketed/system-looking output; Image Studio should not appear blocked by a paid-generation disabled state when the provider is configured; Email and Social need AI creation affordances and live-action enablement clarity; Social upload should preview videos; Calendar should fill available space better; Knowledge Sources needs setup/tutorial guidance and document upload support; Settings/Admin need user-level connection guidance for n8n, HeyGen, Google/Gmail, Telegram, MCPs, and AI subscriptions; Users and Roles needs a better invite/password setup path; and the real LegendsOS logo must appear everywhere the app currently uses the placeholder mark.

## Scene-by-scene notes

| Time | Area | Notes |
|---|---|---|
| 00:00-01:12 | Login | Incorrect logo/branding; palette should be pewter/gold/black/gray; Mac download must work; Windows test build should work; background needs to look better; layout is too spread out and not professional. |
| 01:12-01:37 | Knowledge Sources | Add a tutorial/setup video area under Knowledge Sources so users can learn how to set everything up. |
| 01:37-02:31 | Atlas Chat | Initial chat layout is hard to read and too narrow with wasted side space; after a response it feels closer to how it should always be; users need to enable live social publishing and email sending when appropriate. |
| 02:45-03:49 | Atlas tools/n8n | Quick actions are useful; dynamic/futuristic backgrounds are wanted; Atlas output should not expose bracketed/system-looking content; n8n automation listing should actually work. |
| 03:54-05:03 | Image Studio | FAL/paid generation disabled state blocks Generate; current background assets shown in the library should be usable as platform backgrounds; headshots and brand imagery are present. |
| 05:03-06:34 | Email Studio | External sending needs a clear enablement path; draft list should take less space than the composer/preview; Atlas should be able to draft newsletters into Email Studio; the composer needs an AI assistant/topic generator affordance. |
| 06:34-08:24 | Social Studio | n8n connected but external publishing disabled is confusing; AI generation and Atlas handoff should populate composer content; scheduling mostly works; image/video uploads work, but uploaded video needs a visible preview. |
| 08:34-09:01 | Calendar/Knowledge/Shared | Calendar view is mostly good but should fill space dynamically; Knowledge must accept markdown, PDFs, and related source files. |
| 09:03-10:12 | Settings | Disabled provider/actions need toggles; users need places to connect n8n, HeyGen, Google/Gmail, MCPs, and personal AI subscriptions such as Gemini, OpenAI, Anthropic. |
| 10:12-10:48 | Admin Center | Admin/owner center looks good but should also expose connection setup for Telegram bots, Gmail/Google, and similar services. |
| 10:52-11:47 | Users & Roles | Add user flow works until invite link sharing; that needs to be fixed; owner should be able to set or generate a default password; default model should be OpenRouter/free when appropriate. |
| 11:50-12:23 | Asset Library/Branding | Asset library is good; the visible LegendsOS logo in the library is the correct logo and should replace placeholder `L` marks everywhere. |
| 12:29-13:22 | User connections | Every user needs their own connections, including n8n setup guidance and links, because social/email/calendar actions depend on each user's credentials. |

## Timestamped issues

1. 00:10-00:29 Login logo and color system are wrong; target is pewter/gold/black/gray.
2. 00:29-00:42 Mac download must remain functional; Windows test build should be functional.
3. 00:42-00:51 Login background and alignment are not professional enough.
4. 01:12-01:37 Knowledge Sources needs a tutorial/setup video section.
5. 01:43-02:07 Atlas first-load chat layout is too narrow/hard to read.
6. 02:07-02:31 Live social/email action toggles need a clear enablement path per user/owner.
7. 02:49-03:17 Platform background should use more futuristic/dynamic visual assets; Atlas responses should not expose bracketed/system-looking output.
8. 03:33-03:49 n8n automation discovery/listing must work, or clearly show what is connected.
9. 04:00-05:03 Image Studio is blocked by "paid generation disabled"; Generate button shows a disabled cursor even though the product intent is generation.
10. 04:12-04:17 Existing background assets should be used as the platform background.
11. 05:12-05:18 External email sending needs enablement clarity.
12. 05:21-05:34 Email draft rail should be smaller; composer/preview should be the focus.
13. 05:41-06:34 Email Studio needs Atlas/AI topic-driven generation into the composer.
14. 06:38-06:59 Social Studio needs publishing enablement clarity and AI/Atlas generation affordance.
15. 07:37-08:24 Social scheduling works; media upload works; video upload needs a preview.
16. 08:34-08:42 Calendar should fill available space more dynamically.
17. 08:42-09:01 Knowledge upload must support markdown, PDF, and related source files.
18. 09:03-10:12 Settings needs clearer provider/action toggles and connection setup for n8n, HeyGen, Google/Gmail, MCPs, Gemini/OpenAI/Anthropic subscriptions.
19. 10:24-10:47 Admin Center should expose owner-level connection setup for Telegram/Gmail/Google.
20. 11:17-11:47 Users invite/share flow needs fixing; owner needs password/default credential affordance.
21. 12:07-12:23 Correct LegendsOS logo asset must replace placeholder marks.
22. 12:29-13:22 Users need a connection guide and per-user setup path for n8n/social/email/calendar credentials.

## Priority ranking

P0:
- Preserve login/auth.
- Preserve Mac desktop download.
- Fix broken/blocked-looking Generate behavior in Image Studio without printing or rotating secrets.
- Fix user invite/share affordance where it looked broken.
- Keep Social/Email draft saves working.

P1:
- Replace placeholder logo marks with the real LegendsOS logo.
- Improve login layout/background centering.
- Make Atlas chat readable at first load.
- Add video preview support for uploaded social media.
- Add Knowledge Sources tutorial/setup guidance.
- Add user/admin connection guidance for n8n, HeyGen, Google/Gmail, Telegram, MCPs, and AI subscriptions.

P2:
- Tighten Email Studio density so the draft rail is smaller.
- Improve Calendar dynamic height.
- Improve background use across the app shell.
- Reduce bracketed/system-looking Atlas fallback messages.

Deferred:
- True OAuth connection flows for Google/Gmail/social/HeyGen/Telegram.
- Windows desktop installer if a signed/working Windows artifact cannot be built locally on macOS.
- Live publishing/email sending activation if the required env flags or n8n credentials are not already configured.
- Image-to-image lifestyle generation from a headshot.
- Full per-user n8n credential provisioning.

## Pages affected

- `/login`
- `/dashboard`
- `/atlas`
- `/knowledge`
- `/social`
- `/images`
- `/email`
- `/calendar`
- `/admin`
- `/admin/assets`
- `/admin/users`
- `/settings`

## Exact fixes planned

1. Login and shell branding:
   - Replace placeholder `L` marks with the real `public/assets/logos/legends-os-logo.png`.
   - Tighten the login first viewport so the welcome video/download area and sign-in card feel centered and premium.
   - Use existing command-center background imagery with a darker pewter/gold treatment.

2. Desktop downloads:
   - Keep Mac download linked to `/downloads/LegendsOS.dmg`.
   - Attempt to locate or build a Windows installer; if unavailable, keep the button honest and document the blocker.

3. Atlas:
   - Expand the chat content width and composer width so the empty state is readable on first load.
   - Collapse or reduce unused side-panel impact where practical.
   - Remove raw bracketed error text from visible chat failure messages where the client adds local system messages.

4. Knowledge Sources:
   - Add a setup/tutorial panel with video slots and connection steps.
   - Keep existing file upload controls visible and accepting PDF/DOCX/PPTX/MD/TXT/CSV/JSON/image files.

5. Image Studio:
   - Treat configured/enabled Fal.ai as ready in the UI instead of hard-blocking on `ALLOW_PAID_IMAGE_GENERATION`.
   - Keep provider disabled/not configured states clear and safe.

6. Social Studio:
   - Render uploaded videos with `<video controls>` previews instead of broken image thumbnails.
   - Keep AI Write and Atlas prefill behavior intact.

7. Email Studio:
   - Reduce draft rail width and keep composer/preview as primary.
   - Keep AI Write visible and improve its placement/copy if needed.

8. Settings/Admin:
   - Add clear connection setup surfaces for n8n, HeyGen, Google/Gmail, Telegram, MCPs, and AI subscriptions.
   - Do not collect or print secrets in the browser.
   - Keep provider toggles using the existing server route and stored public provider state.

9. Users & Roles:
   - Improve add-user form so invite link sharing is clearer.
   - Add a safe "temporary password/setup link" affordance that does not expose generated secrets.

10. Calendar:
   - Make the month grid fill more vertical space on large screens while keeping responsive layout stable.

## What will be implemented now

- Action plan and transcript artifacts.
- Real logo usage on login/sidebar/Atlas shell.
- Login layout/background polish using existing assets.
- Atlas readable width changes and cleaner local error text.
- Knowledge tutorial/setup guidance.
- Image Studio readiness fix for configured Fal.ai.
- Social video preview support.
- Email draft rail density adjustment.
- Settings/Admin connection guide cards.
- Users invite/password setup affordance copy.
- Calendar grid height fill improvement.

## What will be deferred

- Real OAuth flows for Google/Gmail/social/HeyGen/Telegram.
- Actually sending live emails or publishing social posts unless existing environment flags already allow it.
- Creating or rotating provider credentials.
- Full user-owned n8n credential provisioning.
- Windows desktop installer if the repo cannot build one locally in this environment.
- Headshot-to-lifestyle image-to-image generation.

## Blockers

- `OPENAI_API_KEY` was not available, so transcription used local `mlx-whisper` instead of the OpenAI transcription CLI.
- Windows desktop download requires a working Windows installer artifact. None was present in `public/downloads/` at review time.
- OAuth-based connection flows need provider app credentials and callback setup; those are not safe to invent in code.

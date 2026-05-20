# NEXT ACTIONS — LegendsOS 2.0

## Desktop apps — what to do now

1. **Test the Mac build locally.** Open `dist-desktop/LegendsOS-2.0.0-arm64.dmg`
   (Apple Silicon) or `LegendsOS-2.0.0.dmg` (Intel), drag the `.app` into
   `/Applications`, then **right-click → Open** the first time to clear
   Gatekeeper. The window should load `legndsosv20.netlify.app` with native
   chrome (Cmd-Q quits, Cmd-R reloads).
2. **Decide hosting for the artifact.** Two clean paths:
   - **Local-only:** `cp dist-desktop/LegendsOS-*-arm64.dmg public/downloads/LegendsOS.dmg`
     and the login page picks it up automatically (the file is gitignored,
     so it stays on Jeremy's laptop). Good for "just for me right now".
   - **Hosted:** push the DMG to a CDN, Netlify Large Media, or a GitHub
     Release, then set `NEXT_PUBLIC_DESKTOP_MAC_DOWNLOAD_URL` on Netlify
     and redeploy. Login button auto-flips to the live URL.
3. **Windows build.** Run `npm run desktop:build:windows` on a Windows
   host (VM, Parallels, or `windows-latest` in GitHub Actions). Config is
   already cross-platform; only the runner OS differs. Drop the resulting
   `LegendsOS-Setup-2.0.0.exe` into `public/downloads/LegendsOS-Setup.exe`
   or behind `NEXT_PUBLIC_DESKTOP_WINDOWS_DOWNLOAD_URL`.
4. **Sign when ready.** Set Apple Developer ID env vars (`CSC_LINK`,
   `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`) and
   re-build — electron-builder auto-signs + notarizes. Same shape on
   Windows via a `.pfx` cert. See `docs/DESKTOP_APPS.md` for the
   walkthrough. No code change required.

Everything else below is the older NEXT_ACTIONS backlog; the desktop app
work above is priority 1 right now.

---

## Do now

1. **Initialize git and push.** Run from repo root:
   ```bash
   git init && git add . && git commit -m "feat: LegendsOS 2.0 clean foundation build"
   git branch -M main
   git remote add origin git@github.com:jeremymac904/LegendsOSv2.0.git
   git push -u origin main
   ```
2. **Create Supabase project.** Apply migrations in order from
   `supabase/migrations/` (init_schema → rls_policies → storage_buckets →
   bootstrap). Use the SQL editor or `supabase db push`.
3. **Set env vars** in `.env.local` (local) and Netlify (production):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_OWNER_EMAIL` (defaults to `jeremy@mcdonald-mtg.com`)
4. **Sign in as the owner** via `/login`. Confirm:
   - `/dashboard` shows owner-only stats and provider table.
   - `/admin` is accessible.
   - A non-owner cannot reach `/admin` (use a second test signup).
5. **Run smoke tests** locally:
   ```bash
   npm run dev
   # in another shell:
   npx playwright install chromium
   npm run test:e2e
   ```

## Do next

6. **DeepSeek audit pass.** Hand DeepSeek the prompt at
   `LegendsOS_v2_Execution_Command_Pack/prompts/DEEPSEEK_AUDIT_PROMPT.md`
   against this repo. Write its output to `docs/deepseek-audit/`.
7. **Codex validation pass.** Hand Codex the prompt at
   `LegendsOS_v2_Execution_Command_Pack/prompts/CODEX_VALIDATION_PROMPT.md`.
   Write its output to `docs/codex-validation/`.
8. **Provider keys.** Add `OPENROUTER_API_KEY` (text) and `FAL_KEY` (images).
   Flip `ALLOW_PAID_TEXT_GENERATION=true` and
   `ALLOW_PAID_IMAGE_GENERATION=true` once billing is confirmed.
9. **n8n workflows.** Sandbox workflows are live on Jeremy's n8n instance
   (https://n8n.srv1124745.hstgr.cloud/webhook/legendsos/*). HMAC removed —
   plain JSON POSTs accepted. Keep `ALLOW_LIVE_*` flags off until end-to-end
   test posts confirm correctness.
10. **Atlas knowledge attach.** Add server logic to inject the top
    `retrieval_references` for the current thread into the chat system prompt.
    Tables and policies already support it.

## Do later

- File uploads UI for `knowledge` collections (drag-drop, Supabase Storage).
- Email Studio HTML editor (Lexical or TipTap), rendered preview.
- Calendar month grid view (current view is a list).
- Owner tooling to flip provider status (`configured` / `disabled`) without SQL.
- Per-user message search across threads (full-text on `chat_messages`).
- Brand asset library backed by `shared_resources` with image previews.
- Postiz API integration as an alternative dispatch target to n8n.

## Requires Jeremy approval

- Flipping any of these env flags to `true`:
  - `ALLOW_LIVE_SOCIAL_PUBLISH`
  - `ALLOW_LIVE_EMAIL_SEND`
  - `ALLOW_PAID_IMAGE_GENERATION`
  - `ALLOW_PAID_TEXT_GENERATION`
- Adding any new module beyond the in-scope eight.
- Connecting paid providers (OpenRouter, DeepSeek, NVIDIA, Fal).
- Pushing to a production Netlify site replacing a live URL.
- Storing real Borrower / Realtor data.

## Do not do

- Do not bring back any v1 module: Blog Studio, LoanFlow, Mortgage Ops,
  Borrower Portal, Realtor Portal, Public Intake, raw Postiz UI, Onyx shell.
- Do not introduce Docker or Cloudflare into the runtime path.
- Do not put provider secrets in any file the browser will see.
- Do not bypass the RLS policies — if a query needs to cross users, use the
  service role server-side and log to `audit_logs`.
- Do not delete the `LegendsOS_v2_Execution_Command_Pack/` directory.
- Do not delete the empty `future/`, `videos/`, `images/` directories without
  checking with Jeremy (they appear to be his workspace).

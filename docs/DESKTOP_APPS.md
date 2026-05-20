# LegendsOS Desktop Apps

LegendsOS ships a native desktop shell for Mac and Windows. The shell is a
thin **Electron** wrapper that loads the hosted Next.js app at
`https://legndsosv20.netlify.app` (or a local URL during development).

The web app is the source of truth — login, session, every page, every API
route. The desktop shell only adds: native window + dock icon + Cmd-Q + safe
external-link handling. When Netlify deploys, the next desktop window load
picks up the new code.

## Why Electron, not Tauri

Tauri would produce smaller binaries (~3 MB vs ~150 MB), but it needs the
Rust toolchain (cargo + rustc + targets). Jeremy's machine has Node 22 and
npm 10 ready — no Rust install — so Electron lets us ship a working Mac
build in one sprint instead of waiting on a Rust setup. We can swap to
Tauri later without changing the web app.

## Files

| Path | Purpose |
|---|---|
| `electron/main.cjs` | Main process. Creates the BrowserWindow, loads the URL, handles external links. |
| `electron/preload.cjs` | Tiny preload exposing `window.legendsos = { desktop: true, shellVersion }` for the web app. |
| `electron/icon.png` | 1024×1024 source icon. electron-builder generates `.icns` / `.ico` automatically. |
| `package.json` → `"build"` | electron-builder config: appId, productName, targets, dmg layout, nsis. |
| `package.json` → `"main"` | Points at `electron/main.cjs` for Electron launches. Next.js ignores it. |

## Running locally

### Against the live deploy (default)

```bash
npm run desktop:dev
```

Opens an Electron window pointed at `https://legndsosv20.netlify.app`. Use
this to QA the production deploy in a native window.

### Against your local dev server

In one shell:
```bash
npm run dev
```

In a second shell:
```bash
npm run desktop:dev:local
```

That sets `LEGENDSOS_DESKTOP_URL=http://localhost:3000` so the window loads
your local app. Hot reload happens server-side — refresh the Electron
window (`Cmd-R`) to pick up changes.

## Building the Mac app

```bash
npm run desktop:build:mac
```

Produces:
- `dist-desktop/LegendsOS-2.0.0-arm64.dmg` — Apple Silicon installer
- `dist-desktop/LegendsOS-2.0.0.dmg` — Intel installer
- `dist-desktop/mac/LegendsOS.app` — unpacked `.app` bundle (for direct testing without DMG)
- `dist-desktop/mac-arm64/LegendsOS.app` — Apple Silicon `.app`

To distribute the simplest single artifact: copy the arm64 DMG to
`public/downloads/LegendsOS.dmg` (gitignored) and the login page picks it
up automatically:

```bash
cp dist-desktop/LegendsOS-*-arm64.dmg public/downloads/LegendsOS.dmg
```

### First-launch warning (unsigned build)

The current build is **unsigned**. macOS Gatekeeper will block it on first
launch with a message like *"LegendsOS can't be opened because Apple cannot
check it for malicious software."* This is expected for a test build. To
open:

1. Drag `LegendsOS.app` from the DMG into `/Applications`.
2. **Right-click → Open** (not double-click). Confirm in the dialog.
3. After one approval, macOS remembers the choice; future launches open
   normally.

If the user closes the warning without right-click-opening, they can also
clear the quarantine attribute:

```bash
xattr -dr com.apple.quarantine /Applications/LegendsOS.app
```

To ship a signed build later, set Apple Developer ID env vars before the
build:

```bash
export CSC_LINK=/path/to/developer-id.p12
export CSC_KEY_PASSWORD=...
export APPLE_ID=...
export APPLE_APP_SPECIFIC_PASSWORD=...
export APPLE_TEAM_ID=...
npm run desktop:build:mac
```

electron-builder will auto-sign + notarize when those are present. No code
changes needed.

## Building the Windows app

### From a Windows machine

```bash
npm run desktop:build:windows
```

Produces:
- `dist-desktop/LegendsOS Setup 2.0.0.exe` — NSIS installer (per-user, can
  choose install location)
- `dist-desktop/win-unpacked/LegendsOS.exe` — unpacked exe (for portable
  use)

### From macOS

Cross-building Windows EXEs from macOS technically works with Wine, but
it's flaky and the SmartScreen experience is worse than a real Windows
build. Two safe options:

1. **Run the Windows build on a Windows VM or machine.** Clone the repo,
   `npm install`, then `npm run desktop:build:windows`. This is the
   recommended path.
2. **GitHub Actions.** Add a workflow that runs on `windows-latest`,
   matrix-built alongside the Mac build. The build config in
   `package.json` is already cross-platform; only the CI runner OS
   differs.

A first-launch SmartScreen warning is also expected for unsigned builds.
The user clicks "More info" → "Run anyway". To sign, set:

```bash
export CSC_LINK=/path/to/codesign.pfx
export CSC_KEY_PASSWORD=...
npm run desktop:build:windows
```

## Where the artifacts live

Three layers, checked in this order by the login page:

1. **`NEXT_PUBLIC_DESKTOP_MAC_DOWNLOAD_URL`** /
   **`NEXT_PUBLIC_DESKTOP_WINDOWS_DOWNLOAD_URL`** — set these env vars on
   Netlify (and `.env.local` for local dev) to point at a hosted artifact
   (CDN, GitHub Release, Netlify Large Media, etc.). When set, the button
   opens the URL in a new tab.

2. **`public/downloads/LegendsOS.dmg`** /
   **`public/downloads/LegendsOS-Setup.exe`** — if no env URL is set but
   the file is present in the build output, the button serves the local
   file via `/downloads/<name>`. Useful for "Jeremy tests on his laptop"
   workflow.

3. **Nothing** — the button renders disabled with copy like *"Mac test
   build pending"* / *"Windows test build pending"*. The login layout
   stays clean.

All three states are server-rendered, no client-side fallback flicker.

## Regenerating the icon

The icon at `electron/icon.png` is generated from
`public/assets/logos/legends-os-logo.png` (900×450) by padding it onto a
1024×1024 dark canvas using macOS `sips`. To regenerate after a logo
update:

```bash
npm run desktop:rebuild-icon
```

For a fully bespoke icon, replace `electron/icon.png` directly with any
1024×1024 PNG. electron-builder generates `.icns` (Mac) and `.ico`
(Windows) from it automatically at build time.

## Updating the desktop app

Because the shell only loads a hosted URL, **most updates are zero-touch**
— Netlify deploys → next window load picks up the new code.

The desktop shell itself only changes when something in `electron/main.cjs`
or the build config changes (e.g. new menu items, signing turned on,
auto-update wiring). When that happens:

1. Bump `DESKTOP_SHELL_VERSION` in `app/login/page.tsx` and `shellVersion`
   in `electron/preload.cjs`.
2. Rebuild: `npm run desktop:build:mac` (and Windows when available).
3. Push the new DMG / EXE to wherever the env URL points (or drop into
   `public/downloads/`).
4. Users re-download via the login page download buttons.

Auto-update (electron-updater) is not yet wired. When you want it, the
work is: install `electron-updater`, point at a GitHub Releases /
generic-URL feed, call `autoUpdater.checkForUpdatesAndNotify()` from
`main.cjs:app.whenReady()`. Out of scope for the current sprint.

## What's still pending

| Item | Status |
|---|---|
| Mac local test build | ✅ produced by `npm run desktop:build:mac` |
| Windows installer | ✅ config ready; must be built on a Windows host or CI |
| Apple Developer ID signing + notarization | ⏳ requires paid Apple Developer account |
| Windows code signing | ⏳ requires a code-signing cert |
| Auto-update channel | ⏳ future sprint |
| Custom DMG background art | ⏳ future polish |
| Native menu items for Atlas / Social etc. | ⏳ future polish |

None of these are blockers for shipping the current Mac test build to
Jeremy.

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
| `scripts/repair-mac-test-build.mjs` | Local Mac test-build repair step. Rebuilds the DMG from a clean temporary app bundle and applies an ad-hoc signature when Apple signing credentials are not configured. |
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

For local unsigned builds, `npm run desktop:build:mac` runs a final repair
step after electron-builder finishes. That step:

1. copies the completed `.app` into a temporary folder with resource forks
   and extended attributes stripped,
2. applies a local ad-hoc signature,
3. rebuilds the DMG from that clean bundle, and
4. mounts the DMG and verifies the app inside it with
   `codesign --verify --deep --strict`.

On Jeremy's Mac, the project folder lives on Desktop, which can be managed
by Apple's FileProvider stack. FileProvider may reattach `FinderInfo`
metadata to package directories under `dist-desktop/` after the build. If
that happens, direct validation of `dist-desktop/mac-arm64/LegendsOS.app`
can fail even when the rebuilt DMG is clean. Treat the DMG and the copied
`/Applications/LegendsOS.app` as the local test artifacts.

To distribute the simplest single artifact: copy the arm64 DMG to
`public/downloads/LegendsOS.dmg` (gitignored) and the login page picks it
up automatically:

```bash
cp dist-desktop/LegendsOS-*-arm64.dmg public/downloads/LegendsOS.dmg
```

### Local test install on Jeremy's Mac

For the current unsigned local build:

1. Drag `LegendsOS.app` from the DMG into `/Applications`.
2. Clear quarantine for the local test app:

   ```bash
   xattr -dr com.apple.quarantine /Applications/LegendsOS.app
   ```

3. Verify the bundle:

   ```bash
   codesign --verify --deep --strict --verbose=2 /Applications/LegendsOS.app
   ```

4. Launch:

   ```bash
   open /Applications/LegendsOS.app
   ```

You can do the same install directly from the verified DMG in one shell:

```bash
tmp_mount=$(mktemp -d /tmp/legendsos-install.XXXXXX)
hdiutil attach -readonly -nobrowse -mountpoint "$tmp_mount" dist-desktop/LegendsOS-2.0.0-arm64.dmg
rm -rf /Applications/LegendsOS.app
/usr/bin/ditto --norsrc --noextattr "$tmp_mount/LegendsOS.app" /Applications/LegendsOS.app
hdiutil detach "$tmp_mount" -quiet
xattr -dr com.apple.quarantine /Applications/LegendsOS.app
open /Applications/LegendsOS.app
```

### First-launch warning (unsigned build)

The current local test build is ad-hoc signed, not Developer ID signed or
notarized. macOS Gatekeeper can block it on first launch with a message like
*"LegendsOS can't be opened because Apple cannot check it for malicious
software."* A quarantined, unsigned, or incompletely sealed Electron bundle
can also show the harsher *"LegendsOS is damaged and can't be opened"*
dialog.

The May 20, 2026 broken artifact had both symptoms:

- the app bundle had no complete `_CodeSignature` seal and `codesign`
  reported `code has no resources but signature indicates they must be
  present`;
- the downloaded app had `com.apple.quarantine` attributes from Chrome.

The local test fix is to rebuild the DMG with the repair script, install the
clean bundle into `/Applications`, and clear quarantine. `spctl` will still
reject the app until it is signed with an Apple Developer ID certificate and
notarized, but the local app can open after quarantine is removed.

If the user closes the warning without right-click-opening, they can also
clear the quarantine attribute:

```bash
xattr -dr com.apple.quarantine /Applications/LegendsOS.app
```

### Production signing and notarization path

For the proper public Mac release, use Apple Developer ID signing and
notarization instead of the local ad-hoc repair path. Required Apple setup:

- active Apple Developer Program membership,
- Developer ID Application certificate exported as a protected `.p12`, or a
  keychain identity available to the build machine,
- Apple notarization credentials, preferably App Store Connect API key
  credentials.

Common electron-builder environment variables:

```bash
export CSC_LINK=/path/to/developer-id.p12
export CSC_KEY_PASSWORD=<p12 password>
export APPLE_API_KEY=/path/to/AuthKey_XXXXXXXXXX.p8
export APPLE_API_KEY_ID=<key id>
export APPLE_API_ISSUER=<issuer id>
npm run desktop:build:mac
```

An Apple ID app-specific password flow can also be used:

```bash
export CSC_LINK=/path/to/developer-id.p12
export CSC_KEY_PASSWORD=<p12 password>
export APPLE_ID=<apple id>
export APPLE_APP_SPECIFIC_PASSWORD=<app-specific password>
export APPLE_TEAM_ID=<team id>
npm run desktop:build:mac
```

When production signing variables are present, the local ad-hoc repair
script skips itself so electron-builder's signed and notarized artifact is
the source of truth. Do not expose certificate files, passwords, Apple IDs,
or API keys in browser code or checked-in files.

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
The user clicks "More info" → "Run anyway". For production, use an OV/EV
Windows code-signing certificate or a managed signing provider such as
Azure Trusted Signing. SmartScreen reputation may still take time to build
after the first signed releases. With a `.pfx`, set:

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

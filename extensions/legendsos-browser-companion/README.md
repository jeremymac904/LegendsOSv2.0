# LegendsOS Browser Companion (Chrome MV3)

A self-contained Chrome extension that captures **safe, visible context** from
your loan portal pages and routes it into LegendsOS (Atlas / FLO / Coordinator
framing). It is **not** part of the Next.js build — it's a standalone unpacked
extension you load into Chrome.

The companion never stores a token of any kind. It authenticates to LegendsOS
using your **existing LegendsOS web-session cookie**.

---

## Load unpacked

1. Open `chrome://extensions`.
2. Toggle **Developer mode** (top-right).
3. Click **Load unpacked**.
4. Select this folder:
   `extensions/legendsos-browser-companion/`.
5. Pin the **LegendsOS Browser Companion** toolbar icon.

### Open the companion

- Click the toolbar icon to open the **side panel** (Chrome 114+).
- On browsers without side-panel support, the same UI opens as a **popup**
  (the toolbar action's `default_popup` fallback).

> **Sign in first.** Open your LegendsOS deployment
> (`https://legndsosv20.netlify.app` by default) and sign in **in the same
> Chrome profile**. The companion reuses that session cookie. If you aren't
> signed in, the status pill shows **"Sign in needed"** with a link to
> `/login`.

---

## Supported domains

The content script auto-runs on the Loan Factory portal:

- `https://*.loanfactory.com/*`
- `https://*.myloanfactory.com/*`

For any other page you've explicitly opened, the companion can still capture via
`activeTab` + on-demand script injection (no broad `<all_urls>` permission). The
"Current page" card shows a **"Supported portal page"** badge when you're on a
recognized portal host.

Host permission for `https://legndsosv20.netlify.app/*` is declared so the
companion can call the LegendsOS companion APIs with your session cookie.

---

## What it does

For the active page you can:

- **Send to assistant** — Atlas (owner), FLO (processor), or Coordinator framing
  (selected in "Route to"). All currently map to **Atlas**, the working AI, with
  a role-appropriate seeded prompt. This is honest: dedicated FLO/Coordinator
  assistants map to Atlas until configured later.
- **Summarize page** / **Draft note** / **Find missing items** /
  **Borrower questions** — each builds a role + task seeded prompt from the
  captured context.

Each action:

1. Captures the current page's **safe** context (see below).
2. Tries a direct authenticated `POST` to
   `<BASE>/api/browser-companion/capture` (`credentials:'include'`).
3. Opens `<BASE>/atlas?prompt=<seeded prompt>` (or the routing link the API
   returns) in a new tab.
4. Shows the seeded prompt in a **read-only Output box** with a **Copy** button
   and an **Open in LegendsOS** button.

**Fallback:** if the direct cross-origin `POST` is blocked (cookies stripped /
CORS), the companion opens
`<BASE>/browser-companion#payload=<encoded>` instead, and the authenticated web
app saves the capture server-side. No data is lost and no token is needed.

---

## Security model

**Authentication — cookie session, no tokens.**
The extension stores **no** OAuth tokens, **no** API keys, and **no** session
tokens. It calls LegendsOS with `fetch(..., { credentials: 'include' })`, so your
existing LegendsOS auth cookie authenticates you. The companion APIs return
`401` when you're signed out (companion shows "Sign in needed").

The only things persisted to `chrome.storage.local` are **non-secret prefs**:

- `legendsos_base_url` — your LegendsOS base URL (editable in Settings).
- `legendsos_last_assistant` — the last routing target you picked.

**What IS captured (safe, visible context only):**

- The current selection (`window.getSelection()`), redacted.
- `document.title` and `location.href`.
- Visible **headings** and visible **label/`dt`/`th` text** that describe the
  page structure.

**What is NEVER captured / read:**

- `document.cookie`, `localStorage`, `sessionStorage` — never touched.
- `input[type=password]`, hidden inputs — excluded.
- **Form values are never read at all** — only labels/headings, not what was
  typed.
- Any field whose name/id/label/placeholder/autocomplete suggests **SSN, DOB,
  account #, routing #, card, CVV, PIN, tax id (EIN/TIN), passport, license,
  FICO/credit score, password/secret** — that field's label is excluded too.
- Free text is run through **redaction** patterns that strip SSN-like numbers,
  long account/card-like digit runs, and API-key/token-like strings before it
  ever leaves the page.

No borrower PII is ever `console.log`ged. The extension contains **no remote
code** and makes no third-party network calls — it only talks to your LegendsOS
deployment.

**No destructive actions.** The companion never submits forms, never writes into
the portal, and never performs any mutation on the portal page.

---

## Configuration

Open **Settings** in the companion to:

- Change the **LegendsOS base URL** (defaults to
  `https://legndsosv20.netlify.app`). Saved to `chrome.storage.local`.
- **Re-check sign-in** to refresh the status pill.

---

## Status states (honest, never faked)

- **Connected** — `GET /api/browser-companion/session` returned an authenticated
  user.
- **Sign in needed** — `401`; not signed in to LegendsOS in this profile.
- **Setup needed** — backend returned `503` / `setupNeeded` (the companion
  database migration hasn't been applied yet). Capture still works via the
  `/browser-companion#payload=` hand-off.
- **Can't reach LegendsOS** — network/URL error; check the base URL or your
  connection.

---

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | MV3 manifest: side panel + popup fallback, narrow host perms |
| `background.js` | Service worker: side-panel behavior, active-tab capture + inject |
| `content.js` | Safe capture (selection, headings, labels) with PII exclusion + redaction |
| `config.js` | Non-secret config + `chrome.storage.local` prefs (base URL, last assistant) |
| `companion.js` | Session check, prompt building, POST + fallback routing |
| `ui.js` | Shared DOM controller for both side panel and popup |
| `sidepanel.html` / `sidepanel.js` | Side-panel UI |
| `popup.html` / `popup.js` | Popup fallback UI |
| `companion.css` | Shared styling (white + silver + gold) |
| `icons/` | Toolbar/extension icons (`icon-16/32/48/128.png`) |

> Icons are simple generated marks. Replace `icons/icon-128.png` (and the
> smaller sizes) with branded artwork when available — the manifest references
> `/icons/icon-128.png`.

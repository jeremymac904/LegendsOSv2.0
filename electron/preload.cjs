// LegendsOS desktop preload script.
//
// Runs in an isolated world (contextIsolation: true) before the page's own
// scripts. The Next.js app runs entirely inside the renderer's normal
// browser environment and talks to Supabase directly, so we expose no Node
// APIs here — only a tiny, read-only "we are the desktop shell" signal.
//
// The web app keys off two things this preload provides:
//   1. `window.legendsosDesktop === true` — the login page uses this to hide
//      the "Download LegendsOS Desktop" card when already inside the app.
//   2. the `is-desktop` class on <html> — globals.css uses this to pad the
//      TopBar clear of the macOS traffic lights.
//
// We also keep the original `window.legendsos` object marker (desktop +
// shellVersion) for any existing consumers; see docs/DESKTOP_APPS.md.
const { contextBridge } = require("electron");

const SHELL_VERSION = "1.0.0";

// Read-only object marker exposed through the context bridge. Safe across the
// isolation boundary — no functions, no Node handles, just data.
contextBridge.exposeInMainWorld("legendsos", {
  desktop: true,
  // Bumped manually when the shell changes shape; the web app can compare.
  shellVersion: SHELL_VERSION,
});

// `exposeInMainWorld` cannot set a primitive directly on `window`, and the
// <html> class must land on the real document the page sees. Both of those
// live in the main world, so we apply them with `exposeInMainWorld` for the
// boolean and a DOM-ready hook for the class. contextBridge keeps us safely
// inside the isolated world — we never touch Node from page-reachable code.
contextBridge.exposeInMainWorld("legendsosDesktop", true);

// Mark the document element so CSS (e.g. `.is-desktop .app-topbar`) can react.
// Apply as early as possible, then guard against the element not yet existing.
function markDesktop() {
  const el =
    typeof document !== "undefined" ? document.documentElement : null;
  if (el && !el.classList.contains("is-desktop")) {
    el.classList.add("is-desktop");
  }
}

if (typeof document !== "undefined") {
  // <html> exists by the time the preload's document is available, so set it
  // now; re-affirm on DOMContentLoaded in case the document was swapped.
  markDesktop();
  document.addEventListener("DOMContentLoaded", markDesktop, { once: true });
}

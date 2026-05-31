/**
 * LegendsOS Browser Companion — popup.js (entry point)
 *
 * Toolbar-popup fallback for browsers/contexts without the side panel.
 * Shares the same UI controller as the side panel. No tokens, no secrets.
 */
(function () {
  "use strict";
  function boot() {
    if (globalThis.LegendsOSUI && typeof globalThis.LegendsOSUI.init === "function") {
      globalThis.LegendsOSUI.init();
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

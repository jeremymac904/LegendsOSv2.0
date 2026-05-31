/**
 * LegendsOS Browser Companion — sidepanel.js (entry point)
 *
 * Thin entry: boot the shared UI controller. Loaded after config.js,
 * companion.js, and ui.js. No tokens, no secrets.
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

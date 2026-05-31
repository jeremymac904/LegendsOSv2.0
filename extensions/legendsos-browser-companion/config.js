/**
 * LegendsOS Browser Companion — config.js
 *
 * Central place for non-secret configuration. This file stores NO tokens,
 * NO API keys, and NO session tokens. The extension authenticates to LegendsOS
 * purely through the user's existing web-session cookie (credentials:'include').
 *
 * The only things persisted to chrome.storage.local are non-secret prefs:
 *   - baseUrl: the LegendsOS base URL (editable in the UI)
 *   - lastAssistant: the last "Send to X" target the user picked
 *
 * Loaded as a classic (non-module) script and exposed on globalThis so it can
 * be shared by background.js (service worker), sidepanel.js, and popup.js.
 */

(function () {
  "use strict";

  // Default LegendsOS deployment. Editable by the user in the UI; the override
  // (if any) is stored in chrome.storage.local under STORAGE_KEYS.baseUrl.
  const DEFAULT_BASE_URL = "https://legndsosv20.netlify.app";

  const STORAGE_KEYS = {
    baseUrl: "legendsos_base_url",
    lastAssistant: "legendsos_last_assistant",
  };

  // API paths on the LegendsOS web app that the companion talks to.
  // These are provided by the LegendsOS "companion API" lane. Every code path
  // that hits them already tolerates 401 (sign-in needed) and network/CORS
  // failures (fall back to the /browser-companion#payload= hand-off).
  const API = {
    session: "/api/browser-companion/session",
    capture: "/api/browser-companion/capture",
  };

  // Where the authenticated web app receives a hand-off payload when a direct
  // cross-origin POST is blocked (cookies stripped). The web app reads
  // location.hash (#payload=<encoded>) and saves server-side under the session.
  const WEB_FALLBACK_PATH = "/browser-companion";

  // Assistant routing targets. All currently map to Atlas (the working AI),
  // with a role-appropriate framing applied when the seeded prompt is built.
  // This is honest: dedicated FLO/Coordinator assistants map to Atlas today.
  const ASSISTANTS = [
    { id: "atlas", label: "Atlas", framing: "owner" },
    { id: "flo", label: "FLO (Processor)", framing: "processor" },
    { id: "coordinator", label: "Coordinator", framing: "coordinator" },
  ];

  // Hostname fragments we treat as "supported portal" pages. Used only for UI
  // labeling ("Supported portal page detected"); capture still works anywhere
  // the content script is injected.
  const SUPPORTED_PORTAL_HOSTS = ["loanfactory.com", "myloanfactory.com"];

  function normalizeBaseUrl(raw) {
    if (!raw || typeof raw !== "string") return DEFAULT_BASE_URL;
    let url = raw.trim();
    if (!url) return DEFAULT_BASE_URL;
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    // Strip a trailing slash so we can concatenate API paths cleanly.
    url = url.replace(/\/+$/, "");
    try {
      // Validate; throws on garbage input.
      // eslint-disable-next-line no-new
      new URL(url);
      return url;
    } catch (_e) {
      return DEFAULT_BASE_URL;
    }
  }

  async function getBaseUrl() {
    try {
      const stored = await chrome.storage.local.get(STORAGE_KEYS.baseUrl);
      return normalizeBaseUrl(stored[STORAGE_KEYS.baseUrl] || DEFAULT_BASE_URL);
    } catch (_e) {
      return DEFAULT_BASE_URL;
    }
  }

  async function setBaseUrl(raw) {
    const normalized = normalizeBaseUrl(raw);
    try {
      await chrome.storage.local.set({ [STORAGE_KEYS.baseUrl]: normalized });
    } catch (_e) {
      /* storage unavailable — non-fatal, fall back to default at read time */
    }
    return normalized;
  }

  async function getLastAssistant() {
    try {
      const stored = await chrome.storage.local.get(STORAGE_KEYS.lastAssistant);
      const id = stored[STORAGE_KEYS.lastAssistant];
      return ASSISTANTS.some((a) => a.id === id) ? id : ASSISTANTS[0].id;
    } catch (_e) {
      return ASSISTANTS[0].id;
    }
  }

  async function setLastAssistant(id) {
    if (!ASSISTANTS.some((a) => a.id === id)) return;
    try {
      await chrome.storage.local.set({ [STORAGE_KEYS.lastAssistant]: id });
    } catch (_e) {
      /* non-fatal */
    }
  }

  function isSupportedPortalHost(hostname) {
    if (!hostname) return false;
    const h = String(hostname).toLowerCase();
    return SUPPORTED_PORTAL_HOSTS.some(
      (frag) => h === frag || h.endsWith("." + frag)
    );
  }

  globalThis.LegendsOSConfig = {
    DEFAULT_BASE_URL,
    STORAGE_KEYS,
    API,
    WEB_FALLBACK_PATH,
    ASSISTANTS,
    SUPPORTED_PORTAL_HOSTS,
    normalizeBaseUrl,
    getBaseUrl,
    setBaseUrl,
    getLastAssistant,
    setLastAssistant,
    isSupportedPortalHost,
  };
})();

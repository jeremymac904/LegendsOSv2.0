/**
 * LegendsOS Browser Companion — background.js (MV3 service worker)
 *
 * Responsibilities:
 *  - Open the side panel when the toolbar icon is clicked (with popup fallback).
 *  - On demand, capture context from the active tab. If the registered content
 *    script isn't present on the current page (e.g. a non-portal page reached
 *    via activeTab), inject content.js programmatically via chrome.scripting,
 *    then ask it to capture. This keeps host_permissions narrow while still
 *    letting the user capture from the tab they explicitly opened.
 *
 * Stores NO tokens and NO secrets. Performs NO network requests itself — the
 * UI surfaces (sidepanel.js / popup.js) own all LegendsOS API calls so the
 * user's session cookie is sent from a normal extension page context.
 */

// Allow the toolbar click to open the side panel. If side panel isn't
// available (older Chrome), the action's default_popup (popup.html) is used
// automatically by Chrome.
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {
      /* non-fatal: popup fallback still works */
    });
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

// Ask the content script in `tabId` to capture. If it isn't there, inject it
// once and retry. Returns the capture payload or throws a coded error.
async function requestCaptureFromTab(tabId) {
  async function ask() {
    return chrome.tabs.sendMessage(tabId, { type: "LEGENDSOS_CAPTURE" });
  }

  try {
    const res = await ask();
    if (res && res.ok) return res.payload;
    throw new Error(res && res.error ? res.error : "capture_failed");
  } catch (_firstErr) {
    // Content script likely not present — inject and retry (activeTab grants
    // this for the tab the user interacted with).
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"],
      });
    } catch (_injectErr) {
      throw new Error("inject_failed");
    }
    const res2 = await ask();
    if (res2 && res2.ok) return res2.payload;
    throw new Error(res2 && res2.error ? res2.error : "capture_failed");
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "LEGENDSOS_CAPTURE_ACTIVE_TAB") {
    return undefined;
  }
  (async () => {
    try {
      const tab = await getActiveTab();
      if (!tab || !tab.id) {
        sendResponse({ ok: false, error: "no_active_tab" });
        return;
      }
      // Block obviously non-capturable schemes (chrome://, extension pages).
      const url = tab.url || "";
      if (/^(chrome|edge|about|chrome-extension|devtools):/i.test(url)) {
        sendResponse({ ok: false, error: "unsupported_page" });
        return;
      }
      const payload = await requestCaptureFromTab(tab.id);
      sendResponse({ ok: true, payload, tabUrl: url });
    } catch (e) {
      sendResponse({ ok: false, error: (e && e.message) || "capture_failed" });
    }
  })();
  // Async response.
  return true;
});

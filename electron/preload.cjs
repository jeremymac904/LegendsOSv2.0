// LegendsOS desktop preload script.
//
// Today the desktop shell needs no IPC — the Next.js app runs entirely
// inside the renderer's normal browser environment and talks to Supabase
// directly. We still ship a preload (with contextIsolation: true) so we
// can later expose a tiny, allowlisted API surface to the page without
// reopening node integration in the renderer.
//
// Right now we just expose a read-only marker the web app can use to
// detect that it's running inside the desktop shell (e.g. to suppress the
// "Download LegendsOS Desktop" card on the login page).
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("legendsos", {
  desktop: true,
  // Bumped manually when the shell changes shape; the web app can compare.
  shellVersion: "1.0.0",
});

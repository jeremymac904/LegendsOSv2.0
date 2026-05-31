"use client";

import { useEffect, useState } from "react";

/**
 * Renders its children only when the app is NOT running inside the LegendsOS
 * desktop (Electron) shell.
 *
 * Web browser users still see whatever is wrapped (e.g. the "Download
 * LegendsOS Desktop" card). Desktop users — where the preload sets
 * `window.legendsosDesktop = true` — get null, since they're already in the
 * app and offering them the download would be a dead end.
 *
 * Hydration note: the server has no way to know it's rendering for the
 * desktop shell, so it always renders the children. To avoid a hydration
 * mismatch we render the children on the first client paint too, then hide
 * them after mount once we can safely read `window`. The flash is invisible
 * in practice — the desktop shell waits for `ready-to-show` before showing
 * the window, so the page is already past first paint when it appears.
 */
export function DesktopDownloadGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      (window as unknown as { legendsosDesktop?: boolean }).legendsosDesktop ===
        true
    ) {
      setIsDesktop(true);
    }
  }, []);

  if (isDesktop) return null;
  return <>{children}</>;
}

export default DesktopDownloadGate;

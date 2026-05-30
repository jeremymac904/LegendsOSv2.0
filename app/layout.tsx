import type { Metadata, Viewport } from "next";

import { ThemeProvider } from "@/components/ui/ThemeProvider";
import { PUBLIC_ENV } from "@/lib/env";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${PUBLIC_ENV.APP_NAME} 2.0`,
    template: `%s · ${PUBLIC_ENV.APP_NAME}`,
  },
  description: `${PUBLIC_ENV.APP_NAME} — internal AI operating system for ${PUBLIC_ENV.TEAM_NAME}.`,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#05060a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // `dark` is the server-render default (no JS yet). THEME_BOOT_SCRIPT runs
    // before paint to replace it with the persisted user preference (or
    // prefers-color-scheme fallback). This avoids the flash-of-wrong-theme.
    <html lang="en" className="dark">
      <head>
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }}
        />
      </head>
      <body className="min-h-screen font-sans antialiased dark:bg-ink-950 dark:text-ink-100">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

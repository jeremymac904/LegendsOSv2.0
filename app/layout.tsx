import type { Metadata, Viewport } from "next";

import { PUBLIC_ENV } from "@/lib/env";

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
    <html lang="en" className="dark">
      <body className="min-h-screen bg-ink-950 font-sans text-ink-100 antialiased">
        {children}
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";

import { AppShell } from "./_components/app-shell";
import { ServiceWorkerRegister } from "./_components/service-worker-register";
import { AppProviders } from "./providers";
import "./globals.css";

const headingFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading-family",
});

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-body-family",
});

export const metadata: Metadata = {
  title: "Fitracker",
  description: "Mobile-first workout execution for assigned training.",
  manifest: "/manifest.webmanifest",
  icons: {
    apple: "/icon.svg",
    icon: "/icon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Fitracker",
  },
};

export const viewport: Viewport = {
  themeColor: "#060816",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={`${headingFont.variable} ${bodyFont.variable}`} lang="en">
      <body>
        <AppProviders>
          <AppShell>{children}</AppShell>
          <ServiceWorkerRegister />
        </AppProviders>
      </body>
    </html>
  );
}

import type { Metadata } from "next";

import { AppShell } from "./_components/app-shell";
import { ServiceWorkerRegister } from "./_components/service-worker-register";
import { AppProviders } from "./providers";
import "./globals.css";

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
    statusBarStyle: "default",
    title: "Fitracker",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppProviders>
          <AppShell>{children}</AppShell>
          <ServiceWorkerRegister />
        </AppProviders>
      </body>
    </html>
  );
}

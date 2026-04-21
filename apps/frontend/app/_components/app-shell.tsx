"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
// biome-ignore lint/style/useImportType: Vitest needs a runtime React import for JSX in this file.
import React from "react";
import { useState } from "react";

import { useSession } from "../providers";

const navItems = [
  { href: "/", label: "Today" },
  { href: "/history", label: "History" },
];

function getRouteMeta(pathname: string) {
  if (pathname === "/history") {
    return {
      eyebrow: "Training archive",
      title: "History",
      subtitle:
        "Review completed sessions and anything that still needs feedback.",
    };
  }

  if (pathname.startsWith("/sessions/") && pathname.endsWith("/feedback")) {
    return {
      eyebrow: "Coach handoff",
      title: "Session feedback",
      subtitle: "Send the short notes that shape the next prescription.",
    };
  }

  if (pathname.startsWith("/sessions/")) {
    return {
      eyebrow: "Live workout",
      title: "Session runner",
      subtitle: "Keep the next action visible, then log the set and move on.",
    };
  }

  if (pathname.startsWith("/workouts/")) {
    return {
      eyebrow: "Workout preview",
      title: "Workout detail",
      subtitle: "Scan the plan, check exercise cues, and start when ready.",
    };
  }

  if (pathname === "/login") {
    return {
      eyebrow: "Secure access",
      title: "Passkey sign in",
      subtitle: "Fast device-first access for athletes without passwords.",
    };
  }

  return {
    eyebrow: "Daily training",
    title: "Today",
    subtitle:
      "Assigned work, active progress, and recent sessions in one clean view.",
  };
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, signOut } = useSession();
  const isAuthed = Boolean(session?.authenticated);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const meta = getRouteMeta(pathname);
  const isMinimalHome = isAuthed && pathname === "/";
  const isMinimalHistory = isAuthed && pathname === "/history";
  const isMinimalShell = isMinimalHome || isMinimalHistory;

  return (
    <div className="app-root">
      <div className="app-backdrop" />
      <div
        className={
          isMinimalShell ? "mobile-shell mobile-shell-home" : "mobile-shell"
        }
      >
        {isMinimalHome ? (
          <div className="home-toolbar">
            <div className="settings-menu-shell">
              <button
                aria-controls="home-settings-menu"
                aria-expanded={settingsOpen}
                aria-haspopup="menu"
                className="icon-button"
                onClick={() => {
                  setSettingsOpen((current) => !current);
                }}
                type="button"
              >
                Settings
              </button>
              {settingsOpen ? (
                <div
                  aria-label="Settings"
                  className="settings-menu"
                  id="home-settings-menu"
                  role="menu"
                >
                  <Link
                    className="settings-menu-item"
                    href="/history"
                    onClick={() => {
                      setSettingsOpen(false);
                    }}
                    role="menuitem"
                  >
                    History
                  </Link>
                  <button
                    className="settings-menu-item"
                    onClick={async () => {
                      setSettingsOpen(false);
                      await signOut();
                      router.push("/login");
                    }}
                    role="menuitem"
                    type="button"
                  >
                    Log out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : isMinimalHistory ? (
          <div className="home-toolbar toolbar-start">
            <Link className="icon-button" href="/">
              Home
            </Link>
          </div>
        ) : (
          <header className="topbar">
            <div className="topbar-surface">
              <div className="topbar-brand">
                <div className="brand-mark">FT</div>
                <div className="title-block">
                  <p className="eyebrow">{meta.eyebrow}</p>
                  <h1 className="topbar-title">{meta.title}</h1>
                  <p className="topbar-subtitle">{meta.subtitle}</p>
                </div>
              </div>

              <div className="topbar-actions">
                {isAuthed ? (
                  <button
                    className="icon-button"
                    onClick={async () => {
                      await signOut();
                      router.push("/login");
                    }}
                    type="button"
                  >
                    Sign out
                  </button>
                ) : null}
              </div>
            </div>
          </header>
        )}

        <main
          className={
            isMinimalShell ? "screen-shell screen-shell-home" : "screen-shell"
          }
        >
          {children}
        </main>

        {isAuthed && !isMinimalShell ? (
          <nav aria-label="Primary" className="bottom-nav">
            {navItems.map((item) => {
              const active =
                pathname === item.href ||
                (item.href === "/" &&
                  pathname !== "/history" &&
                  !pathname.startsWith("/history"));

              return (
                <Link
                  className={
                    active ? "bottom-nav-link active" : "bottom-nav-link"
                  }
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        ) : null}
      </div>
    </div>
  );
}

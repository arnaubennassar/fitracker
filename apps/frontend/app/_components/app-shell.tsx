"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useSession } from "../providers";

const navItems = [
  { href: "/", label: "Today" },
  { href: "/history", label: "History" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, signOut } = useSession();
  const isAuthed = Boolean(session?.authenticated && session.user);

  return (
    <div className="app-root">
      <div className="app-backdrop" />
      <div className="mobile-shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">Fitracker</p>
            <h1 className="topbar-title">
              {pathname === "/history"
                ? "History"
                : pathname.startsWith("/sessions/")
                  ? "Workout"
                  : pathname.startsWith("/workouts/")
                    ? "Workout detail"
                    : pathname === "/login"
                      ? "Passkey access"
                      : "Today"}
            </h1>
          </div>
          {isAuthed ? (
            <div className="topbar-actions">
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
            </div>
          ) : null}
        </header>

        <main className="screen-shell">{children}</main>

        {isAuthed ? (
          <nav aria-label="Primary" className="bottom-nav">
            {navItems.map((item) => {
              const active = pathname === item.href;

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

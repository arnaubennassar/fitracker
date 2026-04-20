"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

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
  const meta = getRouteMeta(pathname);

  return (
    <div className="app-root">
      <div className="app-backdrop" />
      <div className="mobile-shell">
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

        <main className="screen-shell">{children}</main>

        {isAuthed ? (
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

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { buildAuthSession } from "../../test/fixtures";
import { AppShell } from "./app-shell";

const mocks = vi.hoisted(() => ({
  pathname: "/",
  push: vi.fn(),
  session: null as ReturnType<typeof buildAuthSession> | null,
  signOut: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({
    push: mocks.push,
  }),
}));

vi.mock("../providers", () => ({
  useSession: () => ({
    session: mocks.session,
    signOut: mocks.signOut,
  }),
}));

describe("app shell", () => {
  beforeEach(() => {
    mocks.pathname = "/";
    mocks.push.mockReset();
    mocks.session = buildAuthSession();
    mocks.signOut.mockReset();
    mocks.signOut.mockResolvedValue(undefined);
  });

  test("renders the minimal home shell with a settings button", () => {
    render(
      <AppShell>
        <div>Dashboard</div>
      </AppShell>,
    );

    expect(screen.getByRole("button", { name: "Settings" })).toBeVisible();
    expect(
      screen.queryByRole("navigation", { name: "Primary" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Daily training")).not.toBeInTheDocument();
  });

  test("opens the settings menu with history and logout actions", async () => {
    const user = userEvent.setup();

    render(
      <AppShell>
        <div>Dashboard</div>
      </AppShell>,
    );

    await user.click(screen.getByRole("button", { name: "Settings" }));

    expect(screen.getByRole("menuitem", { name: "History" })).toHaveAttribute(
      "href",
      "/history",
    );

    await user.click(screen.getByRole("menuitem", { name: "Log out" }));

    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(mocks.push).toHaveBeenCalledWith("/login");
  });

  test("renders a minimal history shell with a home control", () => {
    mocks.pathname = "/history";

    render(
      <AppShell>
        <div>History page</div>
      </AppShell>,
    );

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      screen.queryByRole("navigation", { name: "Primary" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Training archive")).not.toBeInTheDocument();
  });

  test("renders a minimal workout shell with a home control", () => {
    mocks.pathname = "/workouts/template_foundation_a";

    render(
      <AppShell>
        <div>Workout page</div>
      </AppShell>,
    );

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      screen.queryByRole("navigation", { name: "Primary" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Settings" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Workout detail")).not.toBeInTheDocument();
  });

  test("renders a minimal session shell with a home control", () => {
    mocks.pathname = "/sessions/session_foundation_a";

    render(
      <AppShell>
        <div>Session page</div>
      </AppShell>,
    );

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      screen.queryByRole("navigation", { name: "Primary" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Settings" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Session runner")).not.toBeInTheDocument();
  });
});

import { vi } from "vitest";

import type { AuthSession } from "../app/_lib/types";
import { buildAuthSession } from "./fixtures";

export const routerMock = {
  push: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
};

export const navigationState = {
  params: {} as Record<string, string>,
  pathname: "/",
};

export const sessionHookState = {
  errorMessage: null as string | null,
  loading: false,
  refreshSession: vi.fn(async () => null),
  session: buildAuthSession() as AuthSession | null,
  setSession: vi.fn(),
  signOut: vi.fn(async () => {}),
};

export function setAuthenticatedSession(
  session: AuthSession = buildAuthSession(),
) {
  sessionHookState.loading = false;
  sessionHookState.session = session;
}

export function setUnauthenticatedSession() {
  sessionHookState.loading = false;
  sessionHookState.session = {
    authenticated: false,
    session: null,
  };
}

export function resetPageHarness() {
  routerMock.push.mockReset();
  routerMock.refresh.mockReset();
  routerMock.replace.mockReset();
  sessionHookState.errorMessage = null;
  sessionHookState.loading = false;
  sessionHookState.refreshSession.mockReset();
  sessionHookState.refreshSession.mockResolvedValue(null);
  sessionHookState.session = buildAuthSession();
  sessionHookState.setSession.mockReset();
  sessionHookState.signOut.mockReset();
  sessionHookState.signOut.mockResolvedValue(undefined);
  navigationState.params = {};
  navigationState.pathname = "/";
}

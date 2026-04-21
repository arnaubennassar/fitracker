import { act, render } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { useForegroundRefresh } from "./foreground-refresh";

function ForegroundRefreshHarness({
  disabled = false,
  intervalMs = 30_000,
  refresh,
}: {
  disabled?: boolean;
  intervalMs?: number;
  refresh: () => Promise<unknown> | unknown;
}) {
  useForegroundRefresh({
    disabled,
    intervalMs,
    refresh,
  });

  return null;
}

function deferredPromise() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

describe("useForegroundRefresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test("refreshes on the configured interval while visible", async () => {
    const refresh = vi.fn();

    render(<ForegroundRefreshHarness intervalMs={5_000} refresh={refresh} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
      await Promise.resolve();
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test("waits until the page becomes visible before refreshing", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });

    render(<ForegroundRefreshHarness intervalMs={5_000} refresh={refresh} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(refresh).not.toHaveBeenCalled();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test("does not start a second refresh while one is already in flight", async () => {
    const pending = deferredPromise();
    const refresh = vi.fn().mockReturnValue(pending.promise);

    render(<ForegroundRefreshHarness intervalMs={5_000} refresh={refresh} />);

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("focus"));
      await Promise.resolve();
    });
    expect(refresh).toHaveBeenCalledTimes(1);

    pending.resolve();
  });
});

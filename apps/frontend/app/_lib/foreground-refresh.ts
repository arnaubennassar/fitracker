"use client";

import { useEffect, useRef } from "react";

type UseForegroundRefreshOptions = {
  disabled?: boolean;
  intervalMs?: number;
  refresh: () => Promise<unknown> | unknown;
};

export function useForegroundRefresh({
  disabled = false,
  intervalMs = 30_000,
  refresh,
}: UseForegroundRefreshOptions) {
  const refreshRef = useRef(refresh);
  const inFlightRef = useRef<Promise<unknown> | null>(null);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (disabled || typeof window === "undefined") {
      return;
    }

    function runRefresh() {
      if (document.visibilityState === "hidden" || inFlightRef.current) {
        return;
      }

      const refreshPromise = Promise.resolve(refreshRef.current());

      inFlightRef.current = refreshPromise.finally(() => {
        if (inFlightRef.current === refreshPromise) {
          inFlightRef.current = null;
        }
      });
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        runRefresh();
      }
    }

    window.addEventListener("focus", runRefresh);
    window.addEventListener("pageshow", runRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const intervalId = window.setInterval(runRefresh, intervalMs);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", runRefresh);
      window.removeEventListener("pageshow", runRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      inFlightRef.current = null;
    };
  }, [disabled, intervalMs]);
}

import { render, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { ServiceWorkerRegister } from "./service-worker-register";

describe("service worker register", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, "serviceWorker");
  });

  test("registers the service worker when supported", async () => {
    const register = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });

    render(<ServiceWorkerRegister />);

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith("/sw.js");
    });
  });

  test("does nothing when service workers are unavailable", async () => {
    const register = vi.fn();

    Reflect.deleteProperty(navigator, "serviceWorker");

    render(<ServiceWorkerRegister />);

    await waitFor(() => {
      expect(register).not.toHaveBeenCalled();
    });
  });
});

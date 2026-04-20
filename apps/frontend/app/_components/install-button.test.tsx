import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, test, vi } from "vitest";

import { InstallButton } from "./install-button";

function createInstallPromptEvent() {
  const event = new Event("beforeinstallprompt", {
    cancelable: true,
  }) as Event & {
    prompt: ReturnType<typeof vi.fn>;
    userChoice: Promise<{ outcome: "accepted"; platform: string }>;
  };

  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({
    outcome: "accepted",
    platform: "web",
  });

  return event;
}

describe("install button", () => {
  test("shows browser guidance before install is available", () => {
    render(<InstallButton />);

    expect(
      screen.getByText(
        "Add to home screen from the browser menu if install is available.",
      ),
    ).toBeVisible();
  });

  test("prompts installation when the browser exposes the install event", async () => {
    const user = userEvent.setup();
    const event = createInstallPromptEvent();

    render(<InstallButton />);
    await act(async () => {
      window.dispatchEvent(event);
    });

    await user.click(
      await screen.findByRole("button", { name: "Install app" }),
    );

    await waitFor(() => {
      expect(event.prompt).toHaveBeenCalledTimes(1);
    });
    expect(
      screen.getByText(
        "Add to home screen from the browser menu if install is available.",
      ),
    ).toBeVisible();
  });

  test("shows the installed state after the appinstalled event", async () => {
    render(<InstallButton />);
    await act(async () => {
      window.dispatchEvent(new Event("appinstalled"));
    });

    expect(await screen.findByText("Installed")).toBeVisible();
  });
});

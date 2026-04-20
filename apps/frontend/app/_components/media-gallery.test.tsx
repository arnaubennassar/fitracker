import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, test } from "vitest";

import type { ExerciseMedia } from "../_lib/types";
import { MediaGallery } from "./media-gallery";

const imageMedia: ExerciseMedia = {
  durationSeconds: null,
  id: "media_image",
  mimeType: "image/jpeg",
  sortOrder: 0,
  thumbnailUrl: null,
  type: "image",
  url: "/media/goblet-squat.jpg",
};

const videoMedia: ExerciseMedia = {
  durationSeconds: 30,
  id: "media_video",
  mimeType: "video/mp4",
  sortOrder: 1,
  thumbnailUrl: "/media/goblet-squat.png",
  type: "video",
  url: "/media/goblet-squat.mp4",
};

describe("media gallery", () => {
  test("renders the empty state when no media is attached", () => {
    render(<MediaGallery media={[]} title="Goblet squat" />);

    expect(screen.getByText("No coach media attached yet.")).toBeVisible();
  });

  test("renders image media and falls back when the file fails to load", () => {
    render(<MediaGallery media={[imageMedia]} title="Goblet squat" />);

    const image = screen.getByRole("img", { name: "Goblet squat" });
    expect(image).toHaveAttribute("src", imageMedia.url);

    fireEvent.error(image);

    expect(screen.getByText("Media file unavailable")).toBeVisible();
  });

  test("renders coach videos as external links", () => {
    render(<MediaGallery media={[videoMedia]} title="Goblet squat" />);

    expect(screen.getByRole("link", { name: /Goblet squat/i })).toHaveAttribute(
      "href",
      videoMedia.url,
    );
    expect(screen.getByText("Open coach video")).toBeVisible();
  });
});

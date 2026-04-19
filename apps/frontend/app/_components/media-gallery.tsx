"use client";

import { useState } from "react";

import type { ExerciseMedia } from "../_lib/types";

export function MediaGallery({
  media,
  title,
}: {
  media: ExerciseMedia[];
  title: string;
}) {
  const [failedIds, setFailedIds] = useState<string[]>([]);

  if (media.length === 0) {
    return (
      <div className="media-empty">
        <p>No coach media attached yet.</p>
      </div>
    );
  }

  return (
    <div className="media-grid">
      {media.map((item) => {
        const failed = failedIds.includes(item.id);

        if (failed) {
          return (
            <div className="media-fallback" key={item.id}>
              <p>{title}</p>
              <span>Media file unavailable</span>
            </div>
          );
        }

        if (item.type === "video") {
          return (
            <a
              className="media-fallback"
              href={item.url}
              key={item.id}
              rel="noreferrer"
              target="_blank"
            >
              <p>{title}</p>
              <span>Open coach video</span>
            </a>
          );
        }

        return (
          <img
            alt={title}
            className="media-tile"
            key={item.id}
            onError={() => {
              setFailedIds((current) => [...current, item.id]);
            }}
            src={item.url}
          />
        );
      })}
    </div>
  );
}

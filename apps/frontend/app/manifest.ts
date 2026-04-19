import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#f3efe6",
    description: "Fast mobile workout tracking for assigned training.",
    display: "standalone",
    icons: [
      {
        sizes: "any",
        src: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    name: "Fitracker",
    orientation: "portrait",
    short_name: "Fitracker",
    start_url: "/",
    theme_color: "#145c47",
  };
}

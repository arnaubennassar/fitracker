import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fitracker",
    short_name: "Fitracker",
    description: "Mobile-first workout tracking for Arnau and Fitnaista.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f1e8",
    theme_color: "#0c6b58",
    icons: [],
  };
}

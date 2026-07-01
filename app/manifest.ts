import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AIVENT Concierge",
    short_name: "AIVENT",
    description: "AI event concierge kiosk",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#020713",
    theme_color: "#06172b",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}

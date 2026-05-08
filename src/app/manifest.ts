import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LABORIA Safety Rush",
    short_name: "Safety Rush",
    description: "A premium interactive HS hazard-finding training game by LABORIA.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#06111F",
    theme_color: "#06111F",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/laboria-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/laboria-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

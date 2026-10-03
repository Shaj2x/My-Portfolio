import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Marq Living",
    short_name: "Marq",
    description: "Shuttle, announcements, front desk and amenity booking for residents of The Marq.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f6f5f2",
    theme_color: "#1b2a4a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

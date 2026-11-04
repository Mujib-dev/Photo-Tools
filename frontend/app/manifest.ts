import type { MetadataRoute } from "next";

/**
 * Web app manifest — lets the site be installed on a phone or tablet home
 * screen and run full screen, with the right icons and colours.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PicTools by LynkZone — AI Photo & Creative Suite",
    short_name: "PicTools",
    description:
      "Enterprise photo, document, video and AI creative suite engineered by LynkZone. Fast, offline & local processing with zero cloud data leaks.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#faf8ff",
    theme_color: "#004ac6",
    categories: ["photo", "productivity", "utilities"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Pricing", url: "/pricing" },
      { name: "Profile", url: "/profile" },
    ],
  };
}

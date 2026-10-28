import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Called It",
    short_name: "Called It",
    description: "Cricket calls. Real receipts. A free solo cricket replay game.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0b1015",
    theme_color: "#0b1015",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}

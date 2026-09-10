import { createFileRoute } from "@tanstack/react-router";
import BuildingsGalleryPage from "@/pages/homepage/BuildingsGalleryPage";

export const Route = createFileRoute("/buildings")({
  head: () => ({
    meta: [
      { title: "Choose Building — MathGPL" },
      {
        name: "description",
        content:
          "Browse every complete MathGPL building one at a time — outside, hallways, rooms, frames and screens together — and choose the one you want to teach in.",
      },
      { property: "og:title", content: "Choose Building — MathGPL" },
      {
        property: "og:description",
        content:
          "Browse every complete MathGPL building one at a time and choose the one you want to teach in.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BuildingsGalleryPage,
});

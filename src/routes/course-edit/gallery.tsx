import { createFileRoute } from "@tanstack/react-router";
import { GalleryPage } from "@/components/gallery/GalleryPage";

export const Route = createFileRoute("/course-edit/gallery")({
  head: () => ({
    meta: [
      { title: "Gallery — Saved Lesson Videos | MathGPL Course Edit" },
      {
        name: "description",
        content:
          "Browse, preview, rename, duplicate, download and share every lesson video you have produced, with all of its language versions.",
      },
      { property: "og:title", content: "Gallery — Saved Lesson Videos | MathGPL Course Edit" },
      {
        property: "og:description",
        content: "Manage every finished and draft lesson video and its language versions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GalleryPage,
});

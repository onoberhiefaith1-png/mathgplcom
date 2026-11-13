import { createFileRoute } from "@tanstack/react-router";
import BuildingEditGuard from "@/components/homepage/BuildingEditGuard";
import BuildingsGalleryPage from "@/pages/homepage/BuildingsGalleryPage";

export const Route = createFileRoute("/buildings")({
  head: () => ({
    meta: [
      { title: "Choose Building — Mathemagine" },
      {
        name: "description",
        content:
          "Browse every complete Mathemagine building one at a time — outside, hallways, rooms, frames and screens together — and choose the one you want to teach in.",
      },
      { property: "og:title", content: "Choose Building — Mathemagine" },
      {
        property: "og:description",
        content:
          "Browse every complete Mathemagine building one at a time and choose the one you want to teach in.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <BuildingEditGuard>
      <BuildingsGalleryPage />
    </BuildingEditGuard>
  ),
});

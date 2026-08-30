import { createFileRoute } from "@tanstack/react-router";
import AcademyWorldPage from "@/pages/academy/AcademyWorldPage";

export const Route = createFileRoute("/academy/")({
  head: () => ({
    meta: [
      { title: "The MathGPL Academy — walk the corridor" },
      {
        name: "description",
        content:
          "Step inside the MathGPL Academy: glide down the hallway, enter rooms and discover courses, games and activities on the shelves.",
      },
      { property: "og:title", content: "The MathGPL Academy — walk the corridor" },
      {
        property: "og:description",
        content: "A 3D discovery world where every room, shelf and product is built by your teacher.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AcademyWorldPage,
});

import { createFileRoute } from "@tanstack/react-router";
import AcademyEditorPage from "@/pages/academy/AcademyEditorPage";

export const Route = createFileRoute("/academy/edit")({
  head: () => ({
    meta: [
      { title: "Build the Academy — MathGPL" },
      {
        name: "description",
        content: "Create rooms, sections, topics and shelves, then place your courses and games in the 3D Academy.",
      },
      { property: "og:title", content: "Build the Academy — MathGPL" },
      {
        property: "og:description",
        content: "Design the 3D Academy your learners walk through, with a live preview beside the structure.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AcademyEditorPage,
});

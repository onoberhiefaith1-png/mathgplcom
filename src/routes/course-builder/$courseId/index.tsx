import { createFileRoute } from "@tanstack/react-router";
import CourseEditorPage from "@/pages/CourseEditorPage";

export const Route = createFileRoute("/course-builder/$courseId/")({
  head: () => ({
    meta: [
      { title: "Course Editor — Courses | Mathemagine" },
      {
        name: "description",
        content: "Edit a maths course side by side with the live Student View: background, sections and settings.",
      },
      { property: "og:title", content: "Course Editor — Courses | Mathemagine" },
      {
        property: "og:description",
        content: "Edit a maths course side by side with the live Student View: background, sections and settings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CourseEditorPage,
});

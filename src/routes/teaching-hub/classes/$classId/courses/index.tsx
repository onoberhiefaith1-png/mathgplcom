import { createFileRoute } from "@tanstack/react-router";
import ClassCoursesPage from "@/pages/class/ClassCoursesPage";

export const Route = createFileRoute("/teaching-hub/classes/$classId/courses/")({
  head: () => ({
    meta: [
      { title: "Class Courses — MathGPL" },
      { name: "description", content: "Assign, order and sequence courses into a learning pathway for this class." },
      { property: "og:title", content: "Class Courses — MathGPL" },
      { property: "og:description", content: "Assign, order and sequence courses into a learning pathway for this class." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClassCoursesPage,
});

import { createFileRoute } from "@tanstack/react-router";
import TeacherStudentsPage from "@/pages/teacher/TeacherStudentsPage";

export const Route = createFileRoute("/teaching-hub/students/")({
  head: () => ({
    meta: [
      { title: "My Students — Mathemagine Teaching Hub" },
      { name: "description", content: "Students connected to your Mathemagine teaching workspace." },
      { property: "og:title", content: "My Students — Mathemagine Teaching Hub" },
      { property: "og:description", content: "Students connected to your Mathemagine teaching workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeacherStudentsPage,
});

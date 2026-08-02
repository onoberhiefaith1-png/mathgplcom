import { createFileRoute } from "@tanstack/react-router";
import StudentCourseRunnerPage from "@/pages/student/StudentCourseRunnerPage";

export const Route = createFileRoute("/student/class/$classId/courses/$courseId/")({
  head: () => ({
    meta: [
      { title: "Course — MathGPL" },
      { name: "description", content: "Work through a course in your class learning pathway." },
      { property: "og:title", content: "Course — MathGPL" },
      { property: "og:description", content: "Work through a course in your class learning pathway." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StudentCourseRunnerPage,
});

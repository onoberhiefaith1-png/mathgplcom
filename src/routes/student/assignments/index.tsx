import { createFileRoute } from "@tanstack/react-router";
import StudentAllAssignmentsPage from "@/pages/student/StudentAllAssignmentsPage";

export const Route = createFileRoute("/student/assignments/")({
  head: () => ({
    meta: [
      { title: "Assignments — MathGPL" },
      { name: "description", content: "Assignments from every MathGPL class you belong to, in one list." },
      { property: "og:title", content: "Assignments — MathGPL" },
      { property: "og:description", content: "Assignments from every MathGPL class you belong to, in one list." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StudentAllAssignmentsPage,
});

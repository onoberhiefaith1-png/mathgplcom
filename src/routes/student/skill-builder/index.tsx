import { createFileRoute } from "@tanstack/react-router";
import StudentAllSkillBuilderPage from "@/pages/student/StudentAllSkillBuilderPage";

export const Route = createFileRoute("/student/skill-builder/")({
  head: () => ({
    meta: [
      { title: "Courses — MathGPL" },
      { name: "description", content: "Practice pathways from every MathGPL class you belong to." },
      { property: "og:title", content: "Courses — MathGPL" },
      { property: "og:description", content: "Practice pathways from every MathGPL class you belong to." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StudentAllSkillBuilderPage,
});

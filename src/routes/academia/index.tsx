import { createFileRoute } from "@tanstack/react-router";
import TeacherAcademiaPage from "@/pages/academia/TeacherAcademiaPage";

export const Route = createFileRoute("/academia/")({
  head: () => ({
    meta: [
      { title: "Academia — MathGPL" },
      { name: "description", content: "Build Topics, Subtopics, Sessions and Activities for your school's Academia." },
      { property: "og:title", content: "Academia — MathGPL" },
      { property: "og:description", content: "Your school's shared learning space." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeacherAcademiaPage,
});

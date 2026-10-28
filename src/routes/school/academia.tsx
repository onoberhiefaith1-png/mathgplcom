import { createFileRoute } from "@tanstack/react-router";
import SchoolAcademiaPage from "@/pages/academia/SchoolAcademiaPage";

export const Route = createFileRoute("/school/academia")({
  head: () => ({
    meta: [
      { title: "School Academia — MathGPL" },
      { name: "description", content: "Build your school's Academia: Classes, Subjects and the teachers who build each Subject." },
      { property: "og:title", content: "School Academia — MathGPL" },
      { property: "og:description", content: "Your school's ready-made learning space for teachers and students." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SchoolAcademiaPage,
});

import { createFileRoute } from "@tanstack/react-router";
import SchoolDashboard from "@/pages/accounts/SchoolDashboard";

export const Route = createFileRoute("/school/")({
  head: () => ({
    meta: [
      { title: "School dashboard — MathGPL" },
      { name: "description", content: "Manage your school's teachers, students, classes, reports and billing." },
      { property: "og:title", content: "School dashboard — MathGPL" },
      { property: "og:description", content: "Manage your school's teachers, students, classes, reports and billing." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SchoolDashboard,
});

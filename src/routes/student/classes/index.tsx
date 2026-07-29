import { createFileRoute } from "@tanstack/react-router";
import StudentClassesPage from "@/pages/accounts/StudentClassesPage";

export const Route = createFileRoute("/student/classes/")({
  head: () => ({
    meta: [
      { title: "My Classes — MathGPL" },
      { name: "description", content: "Open the classes you have joined and continue learning." },
      { property: "og:title", content: "My Classes — MathGPL" },
      { property: "og:description", content: "Open the classes you have joined and continue learning." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StudentClassesPage,
});

import { createFileRoute } from "@tanstack/react-router";
import StudentDashboard from "@/pages/accounts/StudentDashboard";

export const Route = createFileRoute("/student/")({
  head: () => ({
    meta: [
      { title: "Learning Hub — Mathemagine" },
      { name: "description", content: "Your Mathemagine learning workspace: classes, assignments, adventures and progress." },
      { property: "og:title", content: "Learning Hub — Mathemagine" },
      { property: "og:description", content: "Your Mathemagine learning workspace: classes, assignments, adventures and progress." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StudentDashboard,
});

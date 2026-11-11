import { createFileRoute } from "@tanstack/react-router";
import TeacherDashboard from "@/pages/accounts/TeacherDashboard";

export const Route = createFileRoute("/teaching-hub/")({
  head: () => ({
    meta: [
      { title: "Teaching Hub — Mathemagine" },
      { name: "description", content: "Your Mathemagine teaching workspace: lesson notes, classes, adventures and live sessions." },
      { property: "og:title", content: "Teaching Hub — Mathemagine" },
      { property: "og:description", content: "Your Mathemagine teaching workspace: lesson notes, classes, adventures and live sessions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeacherDashboard,
});

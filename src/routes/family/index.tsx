import { createFileRoute } from "@tanstack/react-router";
import FamilyDashboard from "@/pages/accounts/FamilyDashboard";

export const Route = createFileRoute("/family/")({
  head: () => ({
    meta: [
      { title: "Parent Console — MathGPL" },
      { name: "description", content: "Follow your children's progress, schools, teachers and achievements from one parent console." },
      { property: "og:title", content: "Parent Console — MathGPL" },
      { property: "og:description", content: "Follow your children's progress, schools, teachers and achievements from one parent console." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FamilyDashboard,
});

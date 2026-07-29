import { createFileRoute } from "@tanstack/react-router";
import FamilyDashboard from "@/pages/accounts/FamilyDashboard";

export const Route = createFileRoute("/family/")({
  head: () => ({
    meta: [
      { title: "Family dashboard — MathGPL" },
      { name: "description", content: "Follow your children's lessons, assignments, reports and achievements." },
      { property: "og:title", content: "Family dashboard — MathGPL" },
      { property: "og:description", content: "Follow your children's lessons, assignments, reports and achievements." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FamilyDashboard,
});

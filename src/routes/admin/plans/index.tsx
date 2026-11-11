import { createFileRoute } from "@tanstack/react-router";
import PlanDashboard from "@/pages/admin/PlanDashboard";

export const Route = createFileRoute("/admin/plans/")({
  head: () => ({
    meta: [
      { title: "Plan management — Mathemagine" },
      {
        name: "description",
        content: "Administrator-only plan versions, prices, included credits and subscription analytics for Mathemagine.",
      },
      { property: "og:title", content: "Plan management — Mathemagine" },
      {
        property: "og:description",
        content: "Administrator-only plan versions, prices, included credits and subscription analytics for Mathemagine.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PlanDashboard,
});

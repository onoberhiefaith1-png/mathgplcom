import { createFileRoute } from "@tanstack/react-router";
import PlanDashboard from "@/pages/admin/PlanDashboard";

export const Route = createFileRoute("/admin/plans/")({
  head: () => ({
    meta: [
      { title: "Plan management — MathGPL" },
      {
        name: "description",
        content: "Administrator-only plan versions, prices, included credits and subscription analytics for MathGPL.",
      },
      { property: "og:title", content: "Plan management — MathGPL" },
      {
        property: "og:description",
        content: "Administrator-only plan versions, prices, included credits and subscription analytics for MathGPL.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PlanDashboard,
});

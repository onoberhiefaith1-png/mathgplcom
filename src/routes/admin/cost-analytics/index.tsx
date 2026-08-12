import { createFileRoute } from "@tanstack/react-router";
import CostAnalytics from "@/pages/admin/CostAnalytics";

export const Route = createFileRoute("/admin/cost-analytics/")({
  head: () => ({
    meta: [
      { title: "Cost analytics — MathGPL" },
      { name: "description", content: "Administrator-only metered cost, customer charge and profit accounting for MathGPL." },
      { property: "og:title", content: "Cost analytics — MathGPL" },
      { property: "og:description", content: "Administrator-only metered cost, customer charge and profit accounting for MathGPL." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CostAnalytics,
});

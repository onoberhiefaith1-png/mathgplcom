import { createFileRoute } from "@tanstack/react-router";
import CostRevenueAnalysis from "@/pages/admin/CostRevenueAnalysis";

export const Route = createFileRoute("/admin/cost-revenue/")({
  head: () => ({
    meta: [
      { title: "Usage & revenue analysis — MathGPL" },
      { name: "description", content: "Administrator-only accounting ledger of platform cost, margin, customer charge and payment status." },
      { property: "og:title", content: "Usage & revenue analysis — MathGPL" },
      { property: "og:description", content: "Administrator-only accounting ledger of platform cost, margin, customer charge and payment status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CostRevenueAnalysis,
});

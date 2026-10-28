import { createFileRoute } from "@tanstack/react-router";
import UsageRevenue from "@/pages/admin/UsageRevenue";

export const Route = createFileRoute("/admin/usage-revenue/")({
  head: () => ({
    meta: [
      { title: "Usage & revenue — MathGPL" },
      { name: "description", content: "Administrator-only measured usage, revenue and margin over time for MathGPL." },
      { property: "og:title", content: "Usage & revenue — MathGPL" },
      { property: "og:description", content: "Administrator-only measured usage, revenue and margin over time for MathGPL." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UsageRevenue,
});

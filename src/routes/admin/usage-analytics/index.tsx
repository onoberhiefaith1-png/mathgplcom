import { createFileRoute } from "@tanstack/react-router";
import UsageAnalytics from "@/pages/admin/UsageAnalytics";

export const Route = createFileRoute("/admin/usage-analytics/")({
  head: () => ({
    meta: [
      { title: "Usage analytics — MathGPL" },
      { name: "description", content: "Administrator-only live usage measurement across database, network, storage, compute, realtime and AI." },
      { property: "og:title", content: "Usage analytics — MathGPL" },
      { property: "og:description", content: "Administrator-only live usage measurement across database, network, storage, compute, realtime and AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UsageAnalytics,
});

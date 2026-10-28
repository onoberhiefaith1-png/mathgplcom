import { createFileRoute } from "@tanstack/react-router";
import AuditDashboard from "@/pages/admin/integrity/AuditDashboard";

export const Route = createFileRoute("/admin/integrity/")({
  head: () => ({
    meta: [
      { title: "System Audit dashboard — MathGPL" },
      {
        name: "description",
        content: "Segment-by-segment integrity audit of every MathGPL page and feature against the permanent standard.",
      },
      { property: "og:title", content: "System Audit dashboard — MathGPL" },
      {
        property: "og:description",
        content: "Segment-by-segment integrity audit of every MathGPL page and feature against the permanent standard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuditDashboard,
});

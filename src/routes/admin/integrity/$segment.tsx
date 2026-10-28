import { createFileRoute } from "@tanstack/react-router";
import SegmentAudit from "@/pages/admin/integrity/SegmentAudit";

export const Route = createFileRoute("/admin/integrity/$segment")({
  head: () => ({
    meta: [
      { title: "Segment audit — MathGPL System Audit" },
      {
        name: "description",
        content: "Audit one MathGPL page or feature against its approved requirements, with evidence, corrections and audit history.",
      },
      { property: "og:title", content: "Segment audit — MathGPL System Audit" },
      {
        property: "og:description",
        content: "Audit one MathGPL page or feature against its approved requirements, with evidence, corrections and audit history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SegmentAudit,
});

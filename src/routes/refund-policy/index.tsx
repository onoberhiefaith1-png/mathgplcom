import { createFileRoute } from "@tanstack/react-router";
import RefundPolicy from "@/pages/legal/RefundPolicy";

export const Route = createFileRoute("/refund-policy/")({
  head: () => ({
    meta: [
      { title: "Refund Policy — MathGPL" },
      {
        name: "description",
        content:
          "How refunds work for MathGPL subscriptions and credits, including unused credits, statutory rights, and how approved refunds are processed through Paddle.",
      },
      { property: "og:title", content: "Refund Policy — MathGPL" },
      {
        property: "og:description",
        content:
          "How refunds work for MathGPL subscriptions and credits, including unused credits, statutory rights, and how approved refunds are processed through Paddle.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RefundPolicy,
});

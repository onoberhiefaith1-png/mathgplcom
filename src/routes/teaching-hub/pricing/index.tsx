import { createFileRoute } from "@tanstack/react-router";
import PricingWorkspace from "@/pages/gateway/PricingWorkspace";

export const Route = createFileRoute("/teaching-hub/pricing/")({
  head: () => ({
    meta: [
      { title: "Pricing — Teaching Hub" },
      { name: "description", content: "Decide what your students get through your gateway, and what you charge." },
      { property: "og:title", content: "Pricing — Teaching Hub" },
      { property: "og:description", content: "Decide what your students get through your gateway, and what you charge." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <PricingWorkspace ownerKind="teacher" />,
});

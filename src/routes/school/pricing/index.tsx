import { createFileRoute } from "@tanstack/react-router";
import PricingWorkspace from "@/pages/gateway/PricingWorkspace";

export const Route = createFileRoute("/school/pricing/")({
  head: () => ({
    meta: [
      { title: "Pricing — School Console" },
      { name: "description", content: "Decide what students get through your school's gateway, and what you charge." },
      { property: "og:title", content: "Pricing — School Console" },
      { property: "og:description", content: "Decide what students get through your school's gateway, and what you charge." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <PricingWorkspace ownerKind="school" />,
});

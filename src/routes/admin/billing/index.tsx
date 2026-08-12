import { createFileRoute } from "@tanstack/react-router";
import BillingCosts from "@/pages/admin/BillingCosts";

export const Route = createFileRoute("/admin/billing/")({
  head: () => ({
    meta: [
      { title: "Billing & costs — MathGPL" },
      { name: "description", content: "Platform cost audit and the MathGPL Master Cost & Expense Catalogue download." },
      { property: "og:title", content: "Billing & costs — MathGPL" },
      { property: "og:description", content: "Platform cost audit and the MathGPL Master Cost & Expense Catalogue download." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BillingCosts,
});

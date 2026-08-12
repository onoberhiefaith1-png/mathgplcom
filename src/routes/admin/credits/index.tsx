import { createFileRoute } from "@tanstack/react-router";
import CreditsEconomics from "@/pages/admin/CreditsEconomics";

export const Route = createFileRoute("/admin/credits/")({
  head: () => ({
    meta: [
      { title: "Credits & economics — MathGPL" },
      {
        name: "description",
        content: "Administrator-only credit cost, profit percentage, derived credit sell price and platform cost catalogue.",
      },
      { property: "og:title", content: "Credits & economics — MathGPL" },
      {
        property: "og:description",
        content: "Administrator-only credit cost, profit percentage, derived credit sell price and platform cost catalogue.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CreditsEconomics,
});

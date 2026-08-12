import { createFileRoute } from "@tanstack/react-router";
import PlansPage from "@/pages/plans/PlansPage";

export const Route = createFileRoute("/plans/")({
  head: () => ({
    meta: [
      { title: "MathGPL plans and credits" },
      {
        name: "description",
        content:
          "Choose a MathGPL plan for your school, teaching or family account. Every plan includes a monthly credit allowance at a locked price.",
      },
      { property: "og:title", content: "MathGPL plans and credits" },
      {
        property: "og:description",
        content:
          "Choose a MathGPL plan for your school, teaching or family account. Every plan includes a monthly credit allowance at a locked price.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlansPage,
});

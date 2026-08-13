import { createFileRoute } from "@tanstack/react-router";
import PlanGatewayPage from "@/pages/plans/PlanGatewayPage";

const DESCRIPTION =
  "Choose the MathGPL plan your account starts on. Every plan includes a monthly credit allowance and can be changed later.";

export const Route = createFileRoute("/plans/gateway")({
  head: () => ({
    meta: [
      { title: "Choose your MathGPL plan" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Choose your MathGPL plan" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanGatewayPage,
});

import { createFileRoute } from "@tanstack/react-router";
import GatewayPage from "@/pages/gateway/GatewayPage";

const DESCRIPTION =
  "Choose your learning plan for this teacher or school on MathGPL and see exactly what each plan includes.";

export const Route = createFileRoute("/g/$handle")({
  head: () => ({
    meta: [
      { title: "Choose your plan — MathGPL Gateway" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Choose your plan — MathGPL Gateway" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GatewayPage,
});

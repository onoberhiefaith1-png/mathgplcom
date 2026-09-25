import { createFileRoute } from "@tanstack/react-router";
import FlowSetupPage from "@/pages/FlowSetupPage";

export const Route = createFileRoute("/flows/$flowId")({
  head: () => ({
    meta: [
      { title: "Flow Setup — MathGPL" },
      { name: "description", content: "Set up a Flow character: clips, cut-out, emotions, Base, Float In and Float Out." },
      { property: "og:title", content: "Flow Setup — MathGPL" },
      { property: "og:description", content: "Set up a Flow character for your lessons." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FlowSetupPage,
});

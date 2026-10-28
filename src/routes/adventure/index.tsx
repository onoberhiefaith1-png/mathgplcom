import { createFileRoute } from "@tanstack/react-router";
import AdventureGamesDashboard from "@/pages/adventure/AdventureGamesDashboard";

export const Route = createFileRoute("/adventure/")({
  head: () => ({
    meta: [
      { title: "My Adventures — MathGPL" },
      { name: "description", content: "Build and manage your video Adventures." },
      { property: "og:title", content: "My Adventures — MathGPL" },
      { property: "og:description", content: "Build and manage your video Adventures." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdventureGamesDashboard,
});

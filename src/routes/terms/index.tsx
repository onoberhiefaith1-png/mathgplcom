import { createFileRoute } from "@tanstack/react-router";
import Terms from "@/pages/legal/Terms";

export const Route = createFileRoute("/terms/")({
  head: () => ({
    meta: [
      { title: "Terms of Service — MathGPL" },
      { name: "description", content: "The terms that govern the use of the MathGPL mathematics teaching and learning platform." },
      { property: "og:title", content: "Terms of Service — MathGPL" },
      { property: "og:description", content: "The terms that govern the use of the MathGPL mathematics teaching and learning platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Terms,
});

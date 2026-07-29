import { createFileRoute } from "@tanstack/react-router";
import Privacy from "@/pages/legal/Privacy";

export const Route = createFileRoute("/privacy/")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — MathGPL" },
      { name: "description", content: "What MathGPL collects, how student information is protected, and how to request deletion." },
      { property: "og:title", content: "Privacy Policy — MathGPL" },
      { property: "og:description", content: "What MathGPL collects, how student information is protected, and how to request deletion." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Privacy,
});

import { createFileRoute } from "@tanstack/react-router";
import Privacy from "@/pages/legal/Privacy";

export const Route = createFileRoute("/privacy/")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Mathemagine" },
      { name: "description", content: "What Mathemagine collects, how student information is protected, and how to request deletion." },
      { property: "og:title", content: "Privacy Policy — Mathemagine" },
      { property: "og:description", content: "What Mathemagine collects, how student information is protected, and how to request deletion." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Privacy,
});

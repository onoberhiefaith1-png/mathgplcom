import { createFileRoute } from "@tanstack/react-router";
import AccessCodesPage from "@/pages/admin/AccessCodesPage";

export const Route = createFileRoute("/admin/access-codes/")({
  head: () => ({
    meta: [
      { title: "Access codes — Mathemagine" },
      { name: "description", content: "Generate and manage personal Mathemagine access codes." },
      { property: "og:title", content: "Access codes — Mathemagine" },
      { property: "og:description", content: "Generate and manage personal Mathemagine access codes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccessCodesPage,
});

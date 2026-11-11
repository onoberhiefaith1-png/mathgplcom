import { createFileRoute } from "@tanstack/react-router";
import AdminAuraTraining from "@/pages/admin/AdminAuraTraining";

export const Route = createFileRoute("/admin/aura-training/")({
  head: () => ({
    meta: [
      { title: "Training review — Mathemagine" },
      {
        name: "description",
        content: "Approve, correct or retire what the Mathemagine assistant has learned about the platform.",
      },
      { property: "og:title", content: "Training review — Mathemagine" },
      {
        property: "og:description",
        content: "Approve, correct or retire what the Mathemagine assistant has learned about the platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminAuraTraining,
});

import { createFileRoute } from "@tanstack/react-router";
import AdminPageGuidesPage from "@/pages/admin/AdminPageGuidesPage";

export const Route = createFileRoute("/admin/guides/")({
  head: () => ({
    meta: [
      { title: "Page Guide Videos — MathGPL Admin" },
      { name: "description", content: "Manage the instructional guide video attached to each MathGPL page." },
      { property: "og:title", content: "Page Guide Videos — MathGPL Admin" },
      { property: "og:description", content: "Manage the instructional guide video attached to each MathGPL page." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPageGuidesPage,
});

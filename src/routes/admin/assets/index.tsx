import { createFileRoute } from "@tanstack/react-router";
import GplAssetsPage from "@/pages/admin/GplAssetsPage";

export const Route = createFileRoute("/admin/assets/")({
  head: () => ({
    meta: [
      { title: "GPL Assets — MathGPL" },
      { name: "description", content: "Manage the official MathGPL asset library: sessions, sub-sessions and assets." },
      { property: "og:title", content: "GPL Assets — MathGPL" },
      { property: "og:description", content: "Manage the official MathGPL asset library." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GplAssetsPage,
});

import { createFileRoute } from "@tanstack/react-router";
import AdminSecurity from "@/pages/admin/AdminSecurity";

export const Route = createFileRoute("/admin/security/")({
  head: () => ({
    meta: [
      { title: "Administrator security — MathGPL" },
      { name: "description", content: "Change the MathGPL administrator email address and password." },
      { property: "og:title", content: "Administrator security — MathGPL" },
      { property: "og:description", content: "Change the MathGPL administrator email address and password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminSecurity,
});

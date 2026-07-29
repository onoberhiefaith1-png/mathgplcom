import { createFileRoute } from "@tanstack/react-router";
import AdminConsole from "@/pages/accounts/AdminConsole";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Platform console — MathGPL" },
      { name: "description", content: "Platform-level accounts, subscriptions and usage for MathGPL." },
      { property: "og:title", content: "Platform console — MathGPL" },
      { property: "og:description", content: "Platform-level accounts, subscriptions and usage for MathGPL." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminConsole,
});

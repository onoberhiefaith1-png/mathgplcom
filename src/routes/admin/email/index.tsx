import { createFileRoute } from "@tanstack/react-router";
import EmailDashboard from "@/pages/admin/EmailDashboard";

export const Route = createFileRoute("/admin/email/")({
  head: () => ({
    meta: [
      { title: "Email Dashboard — MathGPL" },
      { name: "description", content: "Configure the MathGPL sender identity and every platform email template." },
      { property: "og:title", content: "Email Dashboard — MathGPL" },
      { property: "og:description", content: "Configure the MathGPL sender identity and every platform email template." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EmailDashboard,
});

import { createFileRoute } from "@tanstack/react-router";
import VerifiedPage from "@/pages/auth/VerifiedPage";

export const Route = createFileRoute("/auth/verified")({
  head: () => ({
    meta: [
      { title: "Email verified — MathGPL" },
      { name: "description", content: "Your MathGPL account email address has been verified." },
      { property: "og:title", content: "Email verified — MathGPL" },
      { property: "og:description", content: "Your MathGPL account email address has been verified." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VerifiedPage,
});

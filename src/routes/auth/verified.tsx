import { createFileRoute } from "@tanstack/react-router";
import VerifiedPage from "@/pages/auth/VerifiedPage";

export const Route = createFileRoute("/auth/verified")({
  head: () => ({
    meta: [
      { title: "Email verified — Mathemagine" },
      { name: "description", content: "Your Mathemagine account email address has been verified." },
      { property: "og:title", content: "Email verified — Mathemagine" },
      { property: "og:description", content: "Your Mathemagine account email address has been verified." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VerifiedPage,
});

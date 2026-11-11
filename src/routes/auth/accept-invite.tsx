import { createFileRoute } from "@tanstack/react-router";
import AcceptInvitePage from "@/pages/auth/AcceptInvitePage";

export const Route = createFileRoute("/auth/accept-invite")({
  head: () => ({
    meta: [
      { title: "Accept your teaching invitation — Mathemagine" },
      { name: "description", content: "Set your password and open your own Mathemagine teaching workspace." },
      { property: "og:title", content: "Accept your teaching invitation — Mathemagine" },
      { property: "og:description", content: "Set your password and open your own Mathemagine teaching workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AcceptInvitePage,
});

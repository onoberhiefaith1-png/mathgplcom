import { createFileRoute } from "@tanstack/react-router";
import RoleAuthPage from "@/pages/auth/RoleAuthPage";

export const Route = createFileRoute("/auth/admin")({
  head: () => ({
    meta: [
      { title: "Platform Administrator sign in — Mathemagine" },
      { name: "description", content: "Sign in to the Mathemagine platform administration console." },
      { property: "og:title", content: "Platform Administrator sign in — Mathemagine" },
      { property: "og:description", content: "Sign in to the Mathemagine platform administration console." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <RoleAuthPage roleKey="admin" />,
});

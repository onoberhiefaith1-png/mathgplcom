import { createFileRoute } from "@tanstack/react-router";
import RoleAuthPage from "@/pages/auth/RoleAuthPage";

export const Route = createFileRoute("/auth/parent")({
  head: () => ({
    meta: [
      { title: "Parent account — Mathemagine" },
      { name: "description", content: "Create or sign in to a Mathemagine parent account to follow your children's learning." },
      { property: "og:title", content: "Parent account — Mathemagine" },
      { property: "og:description", content: "Create or sign in to a Mathemagine parent account to follow your children's learning." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <RoleAuthPage roleKey="parent" />,
});

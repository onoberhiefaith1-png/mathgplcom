import { createFileRoute } from "@tanstack/react-router";
import RoleAuthPage from "@/pages/auth/RoleAuthPage";

export const Route = createFileRoute("/auth/school")({
  head: () => ({
    meta: [
      { title: "School account — Mathemagine" },
      { name: "description", content: "Create or sign in to a Mathemagine school account to manage teachers, students and classes." },
      { property: "og:title", content: "School account — Mathemagine" },
      { property: "og:description", content: "Create or sign in to a Mathemagine school account to manage teachers, students and classes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <RoleAuthPage roleKey="school" />,
});

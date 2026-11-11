import { createFileRoute } from "@tanstack/react-router";
import RoleAuthPage from "@/pages/auth/RoleAuthPage";

export const Route = createFileRoute("/auth/student")({
  head: () => ({
    meta: [
      { title: "Student account — Mathemagine" },
      { name: "description", content: "Create or sign in to a Mathemagine student account and join your class." },
      { property: "og:title", content: "Student account — Mathemagine" },
      { property: "og:description", content: "Create or sign in to a Mathemagine student account and join your class." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <RoleAuthPage roleKey="student" />,
});

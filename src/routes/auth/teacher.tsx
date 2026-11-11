import { createFileRoute } from "@tanstack/react-router";
import RoleAuthPage from "@/pages/auth/RoleAuthPage";

export const Route = createFileRoute("/auth/teacher")({
  head: () => ({
    meta: [
      { title: "Teacher account — Mathemagine" },
      { name: "description", content: "Create or sign in to a Mathemagine teacher account to build lesson notes, classes and SmartBoards." },
      { property: "og:title", content: "Teacher account — Mathemagine" },
      { property: "og:description", content: "Create or sign in to a Mathemagine teacher account to build lesson notes, classes and SmartBoards." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <RoleAuthPage roleKey="teacher" />,
});

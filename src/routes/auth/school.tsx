import { createFileRoute } from "@tanstack/react-router";
import RoleAuthPage from "@/pages/auth/RoleAuthPage";

export const Route = createFileRoute("/auth/school")({
  head: () => ({
    meta: [
      { title: "School account — MathGPL" },
      { name: "description", content: "Create or sign in to a MathGPL school account to manage teachers, students and classes." },
      { property: "og:title", content: "School account — MathGPL" },
      { property: "og:description", content: "Create or sign in to a MathGPL school account to manage teachers, students and classes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <RoleAuthPage roleKey="school" />,
});

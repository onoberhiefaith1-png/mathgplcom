import { createFileRoute } from "@tanstack/react-router";
import RoleAuthPage from "@/pages/auth/RoleAuthPage";

export const Route = createFileRoute("/auth/student")({
  head: () => ({
    meta: [
      { title: "Student account — MathGPL" },
      { name: "description", content: "Create or sign in to a MathGPL student account and join your class." },
      { property: "og:title", content: "Student account — MathGPL" },
      { property: "og:description", content: "Create or sign in to a MathGPL student account and join your class." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <RoleAuthPage roleKey="student" />,
});

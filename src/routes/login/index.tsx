import { createFileRoute } from "@tanstack/react-router";
import LoginPage from "@/pages/auth/LoginPage";

export const Route = createFileRoute("/login/")({
  head: () => ({
    meta: [
      { title: "Log in — Mathemagine" },
      { name: "description", content: "One Mathemagine login for schools, teachers, parents and students." },
      { property: "og:title", content: "Log in — Mathemagine" },
      { property: "og:description", content: "One Mathemagine login for schools, teachers, parents and students." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

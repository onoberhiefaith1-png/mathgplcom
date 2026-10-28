import { createFileRoute } from "@tanstack/react-router";
import LoginPage from "@/pages/auth/LoginPage";

export const Route = createFileRoute("/login/")({
  head: () => ({
    meta: [
      { title: "Log in — MathGPL" },
      { name: "description", content: "One MathGPL login for schools, teachers, parents and students." },
      { property: "og:title", content: "Log in — MathGPL" },
      { property: "og:description", content: "One MathGPL login for schools, teachers, parents and students." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

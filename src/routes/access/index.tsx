import { createFileRoute } from "@tanstack/react-router";
import SecretAccessPage from "@/pages/access/SecretAccessPage";

export const Route = createFileRoute("/access/")({
  head: () => ({
    meta: [
      { title: "Authorised entrance — Mathemagine" },
      { name: "description", content: "Sign in with a personal Mathemagine access code." },
      { property: "og:title", content: "Authorised entrance — Mathemagine" },
      { property: "og:description", content: "Sign in with a personal Mathemagine access code." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SecretAccessPage,
});

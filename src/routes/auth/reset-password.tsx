import { createFileRoute } from "@tanstack/react-router";
import ResetPasswordPage from "@/pages/auth/ResetPasswordPage";

export const Route = createFileRoute("/auth/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — Mathemagine" },
      { name: "description", content: "Choose a new password for your Mathemagine account." },
      { property: "og:title", content: "Reset your password — Mathemagine" },
      { property: "og:description", content: "Choose a new password for your Mathemagine account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

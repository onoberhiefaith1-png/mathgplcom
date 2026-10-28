import { createFileRoute } from "@tanstack/react-router";
import AccountChooser from "@/pages/auth/AccountChooser";

export const Route = createFileRoute("/auth/")({
  head: () => ({
    meta: [
      { title: "Account — MathGPL" },
      { name: "description", content: "Sign in or create your MathGPL school, teacher, parent or student account." },
      { property: "og:title", content: "Account — MathGPL" },
      { property: "og:description", content: "Sign in or create your MathGPL school, teacher, parent or student account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountChooser,
});

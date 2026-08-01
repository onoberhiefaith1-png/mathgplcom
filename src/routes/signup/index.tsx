import { createFileRoute } from "@tanstack/react-router";
import SignUpPage from "@/pages/auth/SignUpPage";

export const Route = createFileRoute("/signup/")({
  head: () => ({
    meta: [
      { title: "Create your MathGPL account" },
      { name: "description", content: "Create a MathGPL school, teacher, parent or student account in a few steps." },
      { property: "og:title", content: "Create your MathGPL account" },
      { property: "og:description", content: "Create a MathGPL school, teacher, parent or student account in a few steps." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignUpPage,
});

import { createFileRoute } from "@tanstack/react-router";
import SignUpPage from "@/pages/auth/SignUpPage";

export const Route = createFileRoute("/signup/")({
  head: () => ({
    meta: [
      { title: "Create your Mathemagine account" },
      { name: "description", content: "Create a Mathemagine school, teacher, parent or student account in a few steps." },
      { property: "og:title", content: "Create your Mathemagine account" },
      { property: "og:description", content: "Create a Mathemagine school, teacher, parent or student account in a few steps." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignUpPage,
});

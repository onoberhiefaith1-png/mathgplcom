import { createFileRoute } from "@tanstack/react-router";
import HomeDispatcher from "@/pages/accounts/HomeDispatcher";

export const Route = createFileRoute("/home/")({
  head: () => ({
    meta: [
      { title: "Your MathGPL workspace" },
      { name: "description", content: "Open the MathGPL workspace that matches your account type." },
      { property: "og:title", content: "Your MathGPL workspace" },
      { property: "og:description", content: "Open the MathGPL workspace that matches your account type." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HomeDispatcher,
});

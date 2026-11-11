import { createFileRoute } from "@tanstack/react-router";
import HomeDispatcher from "@/pages/accounts/HomeDispatcher";

export const Route = createFileRoute("/home/")({
  head: () => ({
    meta: [
      { title: "Your Mathemagine workspace" },
      { name: "description", content: "Open the Mathemagine workspace that matches your account type." },
      { property: "og:title", content: "Your Mathemagine workspace" },
      { property: "og:description", content: "Open the Mathemagine workspace that matches your account type." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HomeDispatcher,
});

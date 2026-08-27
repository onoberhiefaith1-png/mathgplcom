import { createFileRoute } from "@tanstack/react-router";
import JoinSessionPage from "@/pages/live/JoinSessionPage";

export const Route = createFileRoute("/live/join/")({
  head: () => ({
    meta: [
      { title: "Join a Session — MathGPL Live" },
      {
        name: "description",
        content: "Enter your MathGPL Live session code to join the lesson — no account required.",
      },
      { property: "og:title", content: "Join a Session — MathGPL Live" },
      { property: "og:description", content: "Enter a session code and join the live lesson." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JoinSessionPage,
});

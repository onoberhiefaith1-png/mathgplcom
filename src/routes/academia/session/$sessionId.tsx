import { createFileRoute } from "@tanstack/react-router";
import AcademiaSessionPage from "@/pages/academia/AcademiaSessionPage";

export const Route = createFileRoute("/academia/session/$sessionId")({
  head: () => ({
    meta: [
      { title: "Academia Session — Mathemagine" },
      { name: "description", content: "Watch the session video and work through its activities." },
      { property: "og:title", content: "Academia Session — Mathemagine" },
      { property: "og:description", content: "A Mathemagine Academia learning session." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AcademiaSessionPage,
});

import { createFileRoute } from "@tanstack/react-router";
import JoinSessionPage from "@/pages/live/JoinSessionPage";

export const Route = createFileRoute("/live/join/$code/")({
  head: () => ({
    meta: [
      { title: "Session Invite — Mathemagine Live" },
      {
        name: "description",
        content: "Your invite to a Mathemagine Live lesson — open Notes, SmartBoard and Challenges instantly.",
      },
      { property: "og:title", content: "Session Invite — Mathemagine Live" },
      { property: "og:description", content: "Open the live lesson from your invite link." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JoinSessionPage,
});

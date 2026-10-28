import { createFileRoute } from "@tanstack/react-router";
import ParticipantSessionPage from "@/pages/live/ParticipantSessionPage";

export const Route = createFileRoute("/live/s/$sessionId/")({
  head: () => ({
    meta: [
      { title: "Live Session — MathGPL Live" },
      {
        name: "description",
        content: "Join this MathGPL Live session: Notes, SmartBoard, Challenge and Game Challenge.",
      },
      { property: "og:title", content: "Live Session — MathGPL Live" },
      {
        property: "og:description",
        content: "Open the live lesson — no account needed.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ParticipantSessionPage,
});

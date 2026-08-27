import { createFileRoute } from "@tanstack/react-router";
import AudienceChallengePage from "@/pages/live/audience/AudienceChallengePage";

export const Route = createFileRoute("/live/s/$sessionId/game")({
  head: () => ({
    meta: [
      { title: "Session Game Challenge — MathGPL Live" },
      { name: "description", content: "Play the game challenge set for this MathGPL Live session." },
      { property: "og:title", content: "Session Game Challenge — MathGPL Live" },
      { property: "og:description", content: "Play and solve in the live MathGPL game challenge — no account needed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AudienceChallengePage mode="adventure" />,
});

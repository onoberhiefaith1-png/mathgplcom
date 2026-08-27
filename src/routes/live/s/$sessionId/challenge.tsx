import { createFileRoute } from "@tanstack/react-router";
import AudienceChallengePage from "@/pages/live/audience/AudienceChallengePage";

export const Route = createFileRoute("/live/s/$sessionId/challenge")({
  head: () => ({
    meta: [
      { title: "Session Challenge — MathGPL Live" },
      { name: "description", content: "Solve the challenge set for this MathGPL Live session." },
      { property: "og:title", content: "Session Challenge — MathGPL Live" },
      { property: "og:description", content: "Take part in the live MathGPL challenge — no account needed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AudienceChallengePage mode="assignment" />,
});

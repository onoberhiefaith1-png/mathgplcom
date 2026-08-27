import { createFileRoute } from "@tanstack/react-router";
import AudienceBoardPage from "@/pages/live/audience/AudienceBoardPage";

export const Route = createFileRoute("/live/s/$sessionId/board")({
  head: () => ({
    meta: [
      { title: "Session SmartBoard — MathGPL Live" },
      { name: "description", content: "Follow the live mathematical SmartBoard in this MathGPL Live session." },
      { property: "og:title", content: "Session SmartBoard — MathGPL Live" },
      { property: "og:description", content: "Watch the teacher work live on the MathGPL SmartBoard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AudienceBoardPage,
});

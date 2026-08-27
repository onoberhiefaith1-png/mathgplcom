import { createFileRoute } from "@tanstack/react-router";
import SessionAudiencePage from "@/pages/live/SessionAudiencePage";

export const Route = createFileRoute("/live/sessions/$sessionId/audience")({
  head: () => ({
    meta: [
      { title: "Audience — MathGPL Live" },
      { name: "description", content: "Manage free entry, approvals and who is watching your MathGPL Live session." },
      { property: "og:title", content: "Audience — MathGPL Live" },
      { property: "og:description", content: "Approve and manage the audience of your live session." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SessionAudiencePage,
});

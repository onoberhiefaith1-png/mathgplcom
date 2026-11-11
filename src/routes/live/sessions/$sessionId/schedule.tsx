import { createFileRoute } from "@tanstack/react-router";
import SessionSchedulePage from "@/pages/live/SessionSchedulePage";

const DESCRIPTION =
  "Plan what you will teach in this Mathemagine Live teaching room on each date, so your audience knows the topics ahead.";

export const Route = createFileRoute("/live/sessions/$sessionId/schedule")({
  head: () => ({
    meta: [
      { title: "Room Schedule — Mathemagine Live" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Room Schedule — Mathemagine Live" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SessionSchedulePage,
});

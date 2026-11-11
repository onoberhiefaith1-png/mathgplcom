import { createFileRoute } from "@tanstack/react-router";
import AudienceNotesPage from "@/pages/live/audience/AudienceNotesPage";

export const Route = createFileRoute("/live/s/$sessionId/notes")({
  head: () => ({
    meta: [
      { title: "Session Notes — Mathemagine Live" },
      { name: "description", content: "Read the lesson notes shared for this Mathemagine Live session." },
      { property: "og:title", content: "Session Notes — Mathemagine Live" },
      { property: "og:description", content: "Lesson notes for a live Mathemagine session." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AudienceNotesPage,
});

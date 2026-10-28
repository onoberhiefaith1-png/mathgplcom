import { createFileRoute } from "@tanstack/react-router";
import AudienceNotesPage from "@/pages/live/audience/AudienceNotesPage";

export const Route = createFileRoute("/live/s/$sessionId/notes")({
  head: () => ({
    meta: [
      { title: "Session Notes — MathGPL Live" },
      { name: "description", content: "Read the lesson notes shared for this MathGPL Live session." },
      { property: "og:title", content: "Session Notes — MathGPL Live" },
      { property: "og:description", content: "Lesson notes for a live MathGPL session." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AudienceNotesPage,
});

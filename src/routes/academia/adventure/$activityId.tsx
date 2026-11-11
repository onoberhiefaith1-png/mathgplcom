import { createFileRoute } from "@tanstack/react-router";
import AcademiaAdventurePage from "@/pages/academia/AcademiaAdventurePage";

export const Route = createFileRoute("/academia/adventure/$activityId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Adventure — Mathemagine Academia" },
      { name: "description", content: "Watch the Adventure and solve its questions at each learning point." },
      { property: "og:title", content: "Adventure — Mathemagine Academia" },
      { property: "og:description", content: "Watch the Adventure and solve its questions at each learning point." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AcademiaAdventurePage,
});

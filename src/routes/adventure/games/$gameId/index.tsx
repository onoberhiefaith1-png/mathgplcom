import { createFileRoute } from "@tanstack/react-router";
import GameEditorPage from "@/pages/GameEditorPage";

// The video Adventure editor (videos, progress bars, loops).
export const Route = createFileRoute("/adventure/games/$gameId/")({
  head: () => ({
    meta: [
      { title: "Adventure editor — MathGPL" },
      { name: "description", content: "Edit your video Adventure, its scenes and progress bars." },
      { property: "og:title", content: "Adventure editor — MathGPL" },
      { property: "og:description", content: "Edit your video Adventure, its scenes and progress bars." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <GameEditorPage />,
});

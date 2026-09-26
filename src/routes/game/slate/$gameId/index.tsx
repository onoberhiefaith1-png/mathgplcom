import { createFileRoute } from "@tanstack/react-router";
import GameSlateEditorPage from "@/pages/game/GameSlateEditorPage";

export const Route = createFileRoute("/game/slate/$gameId/")({
  head: () => ({
    meta: [
      { title: "Slate Editor | MathGPL Game Slate" },
      {
        name: "description",
        content:
          "Write on a physical game slate, place dormant rewards and test their effects in view mode.",
      },
      { property: "og:title", content: "Slate Editor | MathGPL Game Slate" },
      {
        property: "og:description",
        content: "Write on a physical game slate and place dormant rewards.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GameSlateEditorPage,
});

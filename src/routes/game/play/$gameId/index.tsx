import { createFileRoute } from "@tanstack/react-router";
import GamePlayPage from "@/pages/game/GamePlayPage";

export const Route = createFileRoute("/game/play/$gameId/")({
  head: () => ({
    meta: [
      { title: "Play Game | MathGPL" },
      {
        name: "description",
        content:
          "Play a MathGPL Game: solve each assigned question on the Floating Numbers board while the Game Slate releases its rewards.",
      },
      { property: "og:title", content: "Play Game | MathGPL" },
      {
        property: "og:description",
        content: "Solve assigned questions on the Floating Numbers board inside the 3D Game Slate.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GamePlayPage,
});

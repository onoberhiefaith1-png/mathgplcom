import { createFileRoute } from "@tanstack/react-router";
import GameFlowSetupPage from "@/pages/imagine/GameFlowSetupPage";

export const Route = createFileRoute("/game/slate/$gameId/flow")({
  head: () => ({ meta: [
    { title: "Game Flow | Mathemagine" },
    { name: "description", content: "Design the Game character scenes shown when a question ends." },
    { property: "og:title", content: "Game Flow | Mathemagine" },
    { property: "og:description", content: "Design a Game's five completion character moments." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: GameFlowSetupPage,
});
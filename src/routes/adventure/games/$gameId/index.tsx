import { createFileRoute } from "@tanstack/react-router";
import AdventureGameEditor from "@/pages/adventure/AdventureGameEditor";

export const Route = createFileRoute("/adventure/games/$gameId/")({
  component: AdventureGameEditor,
});

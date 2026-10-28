import { createFileRoute } from "@tanstack/react-router";
import TallyGame from "@/pages/TallyGame";

export const Route = createFileRoute("/games/tally/")({
  component: TallyGame,
});

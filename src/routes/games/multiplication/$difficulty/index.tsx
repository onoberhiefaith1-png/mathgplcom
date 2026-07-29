import { createFileRoute } from "@tanstack/react-router";
import MultiplicationGame from "@/pages/MultiplicationGame";

export const Route = createFileRoute("/games/multiplication/$difficulty/")({
  component: MultiplicationGame,
});

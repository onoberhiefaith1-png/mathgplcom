import { createFileRoute } from "@tanstack/react-router";
import { FractionMultiplicationGame } from "@/pages/FractionChallengeGame";

export const Route = createFileRoute("/games/fraction-challenge/multiplication/$difficulty/")({
  component: FractionMultiplicationGame,
});

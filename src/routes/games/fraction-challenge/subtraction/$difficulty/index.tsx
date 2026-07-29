import { createFileRoute } from "@tanstack/react-router";
import { FractionSubtractionGame } from "@/pages/FractionChallengeGame";

export const Route = createFileRoute("/games/fraction-challenge/subtraction/$difficulty/")({
  component: FractionSubtractionGame,
});

import { createFileRoute } from "@tanstack/react-router";
import { FractionAdditionGame } from "@/pages/FractionChallengeGame";

export const Route = createFileRoute("/games/fraction-challenge/addition/$difficulty/")({
  component: FractionAdditionGame,
});

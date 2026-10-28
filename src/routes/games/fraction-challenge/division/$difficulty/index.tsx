import { createFileRoute } from "@tanstack/react-router";
import { FractionDivisionGame } from "@/pages/FractionChallengeGame";

export const Route = createFileRoute("/games/fraction-challenge/division/$difficulty/")({
  component: FractionDivisionGame,
});

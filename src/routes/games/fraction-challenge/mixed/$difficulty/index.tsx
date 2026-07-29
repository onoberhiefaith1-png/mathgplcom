import { createFileRoute } from "@tanstack/react-router";
import { FractionMixedGame } from "@/pages/FractionChallengeGame";

export const Route = createFileRoute("/games/fraction-challenge/mixed/$difficulty/")({
  component: FractionMixedGame,
});

import { createFileRoute } from "@tanstack/react-router";
import { FractionMulDivGame } from "@/pages/FractionChallengeGame";

export const Route = createFileRoute("/games/fraction-challenge/mul-div/$difficulty/")({
  component: FractionMulDivGame,
});

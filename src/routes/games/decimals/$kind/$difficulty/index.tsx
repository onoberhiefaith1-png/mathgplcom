import { createFileRoute } from "@tanstack/react-router";
import DecimalChallengeGame from "@/pages/DecimalChallengeGame";

export const Route = createFileRoute("/games/decimals/$kind/$difficulty/")({
  component: DecimalChallengeGame,
});

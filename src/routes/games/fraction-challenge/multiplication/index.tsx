import { createFileRoute } from "@tanstack/react-router";
import { FractionMultiplicationHub } from "@/pages/FractionChallengeHub";

export const Route = createFileRoute("/games/fraction-challenge/multiplication/")({
  component: FractionMultiplicationHub,
});

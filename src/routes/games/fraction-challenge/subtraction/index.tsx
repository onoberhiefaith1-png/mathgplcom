import { createFileRoute } from "@tanstack/react-router";
import { FractionSubtractionHub } from "@/pages/FractionChallengeHub";

export const Route = createFileRoute("/games/fraction-challenge/subtraction/")({
  component: FractionSubtractionHub,
});

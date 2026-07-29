import { createFileRoute } from "@tanstack/react-router";
import { FractionDivisionHub } from "@/pages/FractionChallengeHub";

export const Route = createFileRoute("/games/fraction-challenge/division/")({
  component: FractionDivisionHub,
});

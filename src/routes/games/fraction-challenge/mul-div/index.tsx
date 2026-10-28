import { createFileRoute } from "@tanstack/react-router";
import { FractionMulDivHub } from "@/pages/FractionChallengeHub";

export const Route = createFileRoute("/games/fraction-challenge/mul-div/")({
  component: FractionMulDivHub,
});

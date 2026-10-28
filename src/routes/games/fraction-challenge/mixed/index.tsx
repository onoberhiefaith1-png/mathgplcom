import { createFileRoute } from "@tanstack/react-router";
import { FractionMixedHub } from "@/pages/FractionChallengeHub";

export const Route = createFileRoute("/games/fraction-challenge/mixed/")({
  component: FractionMixedHub,
});

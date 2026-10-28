import { createFileRoute } from "@tanstack/react-router";
import { FractionAdditionHub } from "@/pages/FractionChallengeHub";

export const Route = createFileRoute("/games/fraction-challenge/addition/")({
  component: FractionAdditionHub,
});

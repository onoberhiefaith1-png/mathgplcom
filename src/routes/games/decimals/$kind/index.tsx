import { createFileRoute } from "@tanstack/react-router";
import DecimalChallengeHub from "@/pages/DecimalChallengeHub";

export const Route = createFileRoute("/games/decimals/$kind/")({
  component: DecimalChallengeHub,
});

import { createFileRoute } from "@tanstack/react-router";
import FractionsMixedGame from "@/pages/FractionsMixedGame";

export const Route = createFileRoute("/games/fractions/mixed-to-improper/$difficulty/")({
  component: FractionsMixedGame,
});

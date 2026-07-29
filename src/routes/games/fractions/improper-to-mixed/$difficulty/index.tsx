import { createFileRoute } from "@tanstack/react-router";
import FractionsImproperGame from "@/pages/FractionsImproperGame";

export const Route = createFileRoute("/games/fractions/improper-to-mixed/$difficulty/")({
  component: FractionsImproperGame,
});

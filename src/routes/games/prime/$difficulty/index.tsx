import { createFileRoute } from "@tanstack/react-router";
import PrimeGame from "@/pages/PrimeGame";

export const Route = createFileRoute("/games/prime/$difficulty/")({
  component: PrimeGame,
});

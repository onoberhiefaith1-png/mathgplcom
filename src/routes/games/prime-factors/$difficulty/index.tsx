import { createFileRoute } from "@tanstack/react-router";
import PrimeFactorsGame from "@/pages/PrimeFactorsGame";

export const Route = createFileRoute("/games/prime-factors/$difficulty/")({
  component: PrimeFactorsGame,
});

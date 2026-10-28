import { createFileRoute } from "@tanstack/react-router";
import PrimeFactorsHub from "@/pages/PrimeFactorsHub";

export const Route = createFileRoute("/games/prime-factors/")({
  component: PrimeFactorsHub,
});

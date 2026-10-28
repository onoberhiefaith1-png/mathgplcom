import { createFileRoute } from "@tanstack/react-router";
import PrimeHub from "@/pages/PrimeHub";

export const Route = createFileRoute("/games/prime/")({
  component: PrimeHub,
});

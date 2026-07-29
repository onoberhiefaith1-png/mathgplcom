import { createFileRoute } from "@tanstack/react-router";
import { FractionsMixedHub } from "@/pages/FractionsHubs";

export const Route = createFileRoute("/games/fractions/mixed-to-improper/")({
  component: FractionsMixedHub,
});

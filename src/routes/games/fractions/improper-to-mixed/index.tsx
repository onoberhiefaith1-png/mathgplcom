import { createFileRoute } from "@tanstack/react-router";
import { FractionsImproperHub } from "@/pages/FractionsHubs";

export const Route = createFileRoute("/games/fractions/improper-to-mixed/")({
  component: FractionsImproperHub,
});

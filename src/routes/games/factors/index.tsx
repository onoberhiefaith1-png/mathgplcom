import { createFileRoute } from "@tanstack/react-router";
import FactorHub from "@/pages/FactorHub";

export const Route = createFileRoute("/games/factors/")({
  component: FactorHub,
});

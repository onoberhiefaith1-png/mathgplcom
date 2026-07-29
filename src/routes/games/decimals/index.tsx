import { createFileRoute } from "@tanstack/react-router";
import DecimalsHub from "@/pages/DecimalsHub";

export const Route = createFileRoute("/games/decimals/")({
  component: DecimalsHub,
});

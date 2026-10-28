import { createFileRoute } from "@tanstack/react-router";
import DivisionHub from "@/pages/DivisionHub";

export const Route = createFileRoute("/games/division/")({
  component: DivisionHub,
});

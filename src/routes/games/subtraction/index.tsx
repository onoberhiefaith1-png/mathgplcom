import { createFileRoute } from "@tanstack/react-router";
import SubtractionHub from "@/pages/SubtractionHub";

export const Route = createFileRoute("/games/subtraction/")({
  component: SubtractionHub,
});

import { createFileRoute } from "@tanstack/react-router";
import MultiplicationHub from "@/pages/MultiplicationHub";

export const Route = createFileRoute("/games/multiplication/")({
  component: MultiplicationHub,
});

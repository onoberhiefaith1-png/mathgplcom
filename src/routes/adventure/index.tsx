import { createFileRoute } from "@tanstack/react-router";
import Adventure from "@/pages/Adventure";

export const Route = createFileRoute("/adventure/")({
  component: Adventure,
});

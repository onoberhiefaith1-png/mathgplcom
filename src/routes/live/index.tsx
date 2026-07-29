import { createFileRoute } from "@tanstack/react-router";
import LiveHub from "@/pages/live/LiveHub";

export const Route = createFileRoute("/live/")({
  component: LiveHub,
});

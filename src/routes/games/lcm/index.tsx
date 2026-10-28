import { createFileRoute } from "@tanstack/react-router";
import LcmHub from "@/pages/LcmHub";

export const Route = createFileRoute("/games/lcm/")({
  component: LcmHub,
});

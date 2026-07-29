import { createFileRoute } from "@tanstack/react-router";
import LcmGame from "@/pages/LcmGame";

export const Route = createFileRoute("/games/lcm/$difficulty/")({
  component: LcmGame,
});

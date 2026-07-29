import { createFileRoute } from "@tanstack/react-router";
import BidmasGame from "@/pages/BidmasGame";

export const Route = createFileRoute("/games/bidmas/$difficulty/")({
  component: BidmasGame,
});

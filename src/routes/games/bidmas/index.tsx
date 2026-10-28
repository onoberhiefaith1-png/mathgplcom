import { createFileRoute } from "@tanstack/react-router";
import BidmasHub from "@/pages/BidmasHub";

export const Route = createFileRoute("/games/bidmas/")({
  component: BidmasHub,
});

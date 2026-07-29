import { createFileRoute } from "@tanstack/react-router";
import AdditionHub from "@/pages/AdditionHub";

export const Route = createFileRoute("/games/addition/")({
  component: AdditionHub,
});

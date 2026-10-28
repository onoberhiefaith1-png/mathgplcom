import { createFileRoute } from "@tanstack/react-router";
import SurfaceComparison from "@/components/dev/SurfaceComparison";

export const Route = createFileRoute("/dev/surfaces/")({
  component: SurfaceComparison,
});

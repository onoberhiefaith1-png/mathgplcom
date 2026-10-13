import { createFileRoute, redirect } from "@tanstack/react-router";

/** Old address — Graph was renamed Math Lab. */
export const Route = createFileRoute("/graph")({
  beforeLoad: () => {
    throw redirect({ to: "/math-lab", replace: true });
  },
});

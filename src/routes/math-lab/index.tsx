import { createFileRoute } from "@tanstack/react-router";
import RequireRole from "@/components/auth/RequireRole";
import GraphAppPage from "@/pages/graphApp/GraphAppPage";

export const Route = createFileRoute("/math-lab/")({
  head: () => ({
    meta: [
      { title: "Math Lab — MathGPL Teacher Workspace" },
      { name: "description", content: "Plot graphs, rotate dimensioned solids, calculate volume and surface area, explore matrices and calculus, and save teacher demonstrations." },
      { property: "og:title", content: "Math Lab — MathGPL Teacher Workspace" },
      { property: "og:description", content: "Graphs, rotatable solids with checked measurements, matrices, calculus and saved demonstrations in the MathGPL teacher workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireRole roles={["teacher", "platform_owner", "co_admin"]}>
      <GraphAppPage />
    </RequireRole>
  ),
});

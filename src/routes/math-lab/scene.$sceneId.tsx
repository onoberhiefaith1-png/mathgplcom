import { createFileRoute } from "@tanstack/react-router";
import RequireRole from "@/components/auth/RequireRole";
import SharedScenePage from "@/pages/graphApp/SharedScenePage";

export const Route = createFileRoute("/math-lab/scene/$sceneId")({
  head: () => ({
    meta: [
      { title: "Math Lab Scene — MathGPL" },
      { name: "description", content: "Explore a Math Lab scene your teacher shared with your class." },
      { property: "og:title", content: "Math Lab Scene — MathGPL" },
      { property: "og:description", content: "Explore a Math Lab scene your teacher shared with your class." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => {
    const { sceneId } = Route.useParams();
    return (
      <RequireRole roles={["student", "teacher", "platform_owner", "co_admin"]}>
        <SharedScenePage sceneId={sceneId} />
      </RequireRole>
    );
  },
});

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import RequireRole from "@/components/auth/RequireRole";
import { listSharedMathLabScenes } from "@/lib/graphApp/scenes.functions";

interface SharedScene { id: string; name: string; updated_at: string }

function SharedSceneList() {
  const [scenes, setScenes] = useState<SharedScene[] | null>(null);
  useEffect(() => { listSharedMathLabScenes().then(setScenes).catch(() => setScenes([])); }, []);
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-3 bg-muted p-4">
      <Link to="/home" className="flex items-center gap-1 text-sm font-semibold hover:underline"><ArrowLeft className="h-4 w-4" /> Back</Link>
      <h1 className="text-xl font-bold">Math Lab scenes from your teachers</h1>
      {scenes === null && <p className="text-sm text-muted-foreground">Loading…</p>}
      {scenes?.length === 0 && <p className="text-sm text-muted-foreground">No scenes shared with your classes yet.</p>}
      <ul className="space-y-2">
        {scenes?.map((s) => (
          <li key={s.id}>
            <Link to="/math-lab/scene/$sceneId" params={{ sceneId: s.id }}
              className="block rounded-xl border bg-card p-4 font-medium shadow-sm hover:bg-accent">
              {s.name}
              <span className="block text-xs font-normal text-muted-foreground">Updated {new Date(s.updated_at).toLocaleDateString()}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const Route = createFileRoute("/math-lab/scenes")({
  head: () => ({
    meta: [
      { title: "Shared Math Lab Scenes — MathGPL" },
      { name: "description", content: "Math Lab scenes your teachers shared with your classes." },
      { property: "og:title", content: "Shared Math Lab Scenes — MathGPL" },
      { property: "og:description", content: "Math Lab scenes your teachers shared with your classes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireRole roles={["student", "teacher", "platform_owner", "co_admin"]}>
      <SharedSceneList />
    </RequireRole>
  ),
});

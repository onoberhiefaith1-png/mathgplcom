import { useEffect, useState } from "react";
import GraphAppPage from "./GraphAppPage";
import { getMathLabScene, type SceneControls } from "@/lib/graphApp/scenes.functions";
import type { LabSnapshot } from "@/lib/graphApp/savedGraphs";

/** Student view of a teacher-shared Math Lab scene: only the controls the teacher allowed. */
export default function SharedScenePage({ sceneId }: { sceneId: string }) {
  const [scene, setScene] = useState<{ name: string; snapshot: LabSnapshot; controls: SceneControls } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMathLabScene({ data: { id: sceneId } })
      .then((s) => setScene({ name: s.name, snapshot: s.snapshot as LabSnapshot, controls: s.controls as SceneControls }))
      .catch(() => setError("This scene is not shared with you, or it has been removed."));
  }, [sceneId]);

  if (error) return <div className="grid h-dvh place-items-center bg-muted p-6 text-center text-sm text-muted-foreground">{error}</div>;
  if (!scene) return <div className="grid h-dvh place-items-center bg-muted text-sm text-muted-foreground">Loading scene…</div>;
  return <GraphAppPage initialSnapshot={scene.snapshot} allowed={scene.controls} studentMode sceneName={scene.name} />;
}

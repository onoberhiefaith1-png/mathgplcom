import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Plus, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import SceneFrame from "@/components/adventure/editor/SceneFrame";
import ChallengeTypePicker from "@/components/adventure/editor/ChallengeTypePicker";
import {
  createScene, deleteScene, getGame, listScenes, updateScene,
} from "@/lib/adventure/api";
import type { AdventureGame, AdventureScene, SceneKind } from "@/lib/adventure/types";
import { toast } from "@/hooks/use-toast";

export default function AdventureGameEditor() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [game, setGame] = useState<AdventureGame | null>(null);
  const [scenes, setScenes] = useState<AdventureScene[]>([]);
  const [picking, setPicking] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!gameId) return;
    (async () => {
      try {
        const [g, s] = await Promise.all([getGame(gameId), listScenes(gameId)]);
        setGame(g); setScenes(s);
      } catch (e: unknown) {
        toast({ title: "Could not load game", description: msg(e), variant: "destructive" });
      } finally { setLoading(false); }
    })();
  }, [gameId]);

  const addScene = async (kind: SceneKind) => {
    if (!gameId) return;
    try {
      const created = await createScene({ game_id: gameId, kind, order_index: scenes.length, background_ref: null });
      setScenes((arr) => [...arr, created]);
    } catch (e: unknown) {
      toast({ title: "Could not add scene", description: msg(e), variant: "destructive" });
    }
  };

  const updateLocal = (id: string, patch: Partial<AdventureScene>) => {
    setScenes((arr) => arr.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const move = async (id: string, dir: -1 | 1) => {
    const i = scenes.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= scenes.length) return;
    const next = scenes.slice();
    [next[i], next[j]] = [next[j], next[i]];
    next.forEach((s, idx) => (s.order_index = idx));
    setScenes(next);
    await Promise.all(next.map((s, idx) => updateScene(s.id, { order_index: idx })));
  };

  const duplicate = async (id: string) => {
    const s = scenes.find((x) => x.id === id);
    if (!s || !gameId) return;
    try {
      const created = await createScene({
        game_id: gameId, kind: s.kind, order_index: scenes.length, background_ref: s.background_ref,
      });
      await updateScene(created.id, { layout_json: s.layout_json, title: s.title, required_progress: s.required_progress });
      const fresh = await listScenes(gameId);
      setScenes(fresh);
    } catch (e: unknown) { toast({ title: "Duplicate failed", description: msg(e), variant: "destructive" }); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this scene?")) return;
    try { await deleteScene(id); setScenes((arr) => arr.filter((s) => s.id !== id)); }
    catch (e: unknown) { toast({ title: "Delete failed", description: msg(e), variant: "destructive" }); }
  };

  if (loading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!game) return <div className="p-8">Game not found. <Link to="/adventure/games" className="underline">Back</Link></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur p-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/adventure/games")}><ArrowLeft className="h-4 w-4 mr-1" /> Games</Button>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{game.name}</div>
          <div className="text-xs text-muted-foreground truncate">{[game.topic, game.subtopic].filter(Boolean).join(" · ")}</div>
        </div>
        <Button onClick={() => setPicking(true)}><Plus className="h-4 w-4 mr-1" /> Add Scene</Button>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-4">
        {scenes.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
            No scenes yet. Click <strong>Add Scene</strong> to start building your adventure.
          </div>
        ) : (
          scenes.map((s, i) => (
            <div key={s.id}>
              <SceneFrame
                scene={s}
                index={i}
                total={scenes.length}
                onMove={(d) => move(s.id, d)}
                onDuplicate={() => duplicate(s.id)}
                onDelete={() => remove(s.id)}
                onLocalUpdate={(patch) => updateLocal(s.id, patch)}
              />
              {i < scenes.length - 1 && (
                <div className="flex justify-center py-2 text-muted-foreground"><ChevronDown className="h-6 w-6" /></div>
              )}
            </div>
          ))
        )}

        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={() => setPicking(true)}><Plus className="h-4 w-4 mr-1" /> Add Scene</Button>
        </div>
      </main>

      <ChallengeTypePicker open={picking} onClose={() => setPicking(false)} onPick={addScene} />
    </div>
  );
}

function msg(e: unknown) { return e instanceof Error ? e.message : String(e); }

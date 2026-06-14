import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createGame, deleteGame, listGames, sceneCount } from "@/lib/adventure/api";
import type { AdventureGame } from "@/lib/adventure/types";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Row extends AdventureGame { scenes?: number }

export default function AdventureGamesDashboard() {
  const navigate = useNavigate();
  const [games, setGames] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", topic: "", subtopic: "", description: "" });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate("/auth", { replace: true });
    });
  }, [navigate]);

  const load = async () => {
    setLoading(true);
    try {
      const list = await listGames();
      const withCounts: Row[] = await Promise.all(
        list.map(async (g) => ({ ...g, scenes: await sceneCount(g.id).catch(() => 0) })),
      );
      setGames(withCounts);
    } catch (e: unknown) {
      toast({ title: "Could not load games", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.name.trim()) return;
    try {
      const g = await createGame({
        name: form.name.trim(),
        topic: form.topic.trim() || undefined,
        subtopic: form.subtopic.trim() || undefined,
        description: form.description.trim() || undefined,
      });
      setOpen(false);
      setForm({ name: "", topic: "", subtopic: "", description: "" });
      navigate(`/adventure/games/${g.id}`);
    } catch (e: unknown) {
      toast({ title: "Could not create game", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this game? This removes all its scenes and questions.")) return;
    try { await deleteGame(id); setGames((arr) => arr.filter((g) => g.id !== id)); }
    catch (e: unknown) { toast({ title: "Delete failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" }); }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b p-4 flex items-center gap-3">
        <Link to="/adventure" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" /> Adventure
        </Link>
        <h1 className="text-xl font-semibold flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Adventure Games</h1>
        <Button onClick={() => setOpen(true)} className="ml-auto"><Plus className="h-4 w-4 mr-1" /> Create Game</Button>
      </header>

      <main className="mx-auto max-w-6xl p-6">
        {loading ? (
          <div className="text-muted-foreground">Loading…</div>
        ) : games.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
            No adventure games yet. Click <strong>Create Game</strong> to start.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {games.map((g) => (
              <div key={g.id} className="group relative rounded-lg border bg-card p-4 hover:border-primary transition cursor-pointer"
                onClick={() => navigate(`/adventure/games/${g.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{g.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{[g.topic, g.subtopic].filter(Boolean).join(" · ") || "—"}</div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); remove(g.id); }} className="opacity-0 group-hover:opacity-100 text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {g.description && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{g.description}</p>}
                <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                  <span>{g.scenes ?? 0} scene{g.scenes === 1 ? "" : "s"}</span>
                  <span>Updated {new Date(g.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Adventure Game</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Game Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Factorisation Adventure" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Topic</Label><Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="Algebra" /></div>
              <div><Label>Subtopic</Label><Input value={form.subtopic} onChange={(e) => setForm({ ...form, subtopic: e.target.value })} placeholder="Factorisation" /></div>
            </div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Students work together to unlock the castle by solving factorisation challenges." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={!form.name.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

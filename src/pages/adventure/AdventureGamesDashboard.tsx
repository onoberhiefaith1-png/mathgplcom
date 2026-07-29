import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "@/lib/router-compat";
import { ArrowLeft, Gamepad2, Loader2, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import GameCard from "@/components/gamebuilder/GameCard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { createGame, deleteGame, generateGameCover, listGames, renameGame } from "@/lib/games/games";
import type { GameRow } from "@/lib/games/types";

const AdventureGamesDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [games, setGames] = useState<GameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [pendingCovers, setPendingCovers] = useState<Set<string>>(new Set());

  const [renameTarget, setRenameTarget] = useState<GameRow | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<GameRow | null>(null);

  const refresh = useCallback(async () => {
    try { setGames(await listGames()); }
    catch (e) { console.error(e); toast({ title: "Could not load games", variant: "destructive" }); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { refresh(); }, [refresh]);

  const markPending = (id: string, on: boolean) =>
    setPendingCovers((prev) => { const next = new Set(prev); on ? next.add(id) : next.delete(id); return next; });

  const runCover = useCallback(async (id: string, title: string) => {
    markPending(id, true);
    const path = await generateGameCover(id, title);
    if (path) setGames((prev) => prev.map((g) => (g.id === id ? { ...g, thumbnail_path: path } : g)));
    markPending(id, false);
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { navigate("/auth"); return; }
      const game = await createGame();
      setGames((prev) => [game, ...prev]);
      runCover(game.id, game.title);
      navigate(`/adventure/games/${game.id}`);
    } catch (e) { console.error(e); toast({ title: "Could not create game", variant: "destructive" }); }
    finally { setCreating(false); }
  };

  const submitRename = async () => {
    if (!renameTarget) return;
    const title = renameValue.trim() || "Untitled Game";
    try {
      await renameGame(renameTarget.id, title);
      setGames((prev) => prev.map((g) => (g.id === renameTarget.id ? { ...g, title } : g)));
    } catch (e) { console.error(e); toast({ title: "Rename failed", variant: "destructive" }); }
    finally { setRenameTarget(null); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    try { await deleteGame(id); setGames((prev) => prev.filter((g) => g.id !== id)); }
    catch (e) { console.error(e); toast({ title: "Delete failed", variant: "destructive" }); }
  };

  const filtered = games.filter((g) => g.title.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-5 py-6">
        <div className="flex flex-wrap items-center gap-4">
          <Link to="/adventure" className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-card/40 px-3 py-1.5 text-sm text-muted-foreground transition hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary">
              <Gamepad2 className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold uppercase tracking-wide">Game Mode</h1>
              <p className="text-sm text-muted-foreground">Create and manage your adventure games</p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search games…" className="w-56 pl-9" />
            </div>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
              Create Game
            </Button>
          </div>
        </div>

        <div className="mt-8">
          {loading ? (
            <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border/50 py-20 text-center">
              <Gamepad2 className="h-12 w-12 text-primary/40" />
              <div>
                <p className="text-lg font-semibold">{games.length === 0 ? "No games yet" : "No games match your search"}</p>
                <p className="text-sm text-muted-foreground">{games.length === 0 ? "Create your first adventure game to get started." : "Try a different name."}</p>
              </div>
              {games.length === 0 && (
                <Button onClick={handleCreate} disabled={creating}><Plus className="mr-1.5 h-4 w-4" /> Create Game</Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {filtered.map((g) => (
                <GameCard key={g.id} game={g} coverPending={pendingCovers.has(g.id)}
                  onOpen={(id) => navigate(`/adventure/games/${id}`)}
                  onRename={(game) => { setRenameTarget(game); setRenameValue(game.title); }}
                  onRegenerate={(game) => runCover(game.id, game.title)}
                  onDelete={(game) => setDeleteTarget(game)} />
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename game</DialogTitle></DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitRename()} autoFocus />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRenameTarget(null)}>Cancel</Button>
            <Button onClick={submitRename}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the game and all its scenes. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdventureGamesDashboard;

// "Add Game" on an Academia Session Adventure: pick which existing Game's
// writing surfaces play over this Adventure's learning points.
import { useEffect, useState } from "react";
import { Gamepad2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listGames } from "@/lib/slate/storage";
import type { Game } from "@/lib/slate/types";
import { setAdventureGame } from "@/lib/academia/adventureSlots";

export default function AdventureGameButton({ activityId, gameId }: { activityId: string; gameId: string | null }) {
  const [open, setOpen] = useState(false);
  const [games, setGames] = useState<Game[] | null>(null);
  const [query, setQuery] = useState("");
  const [current, setCurrent] = useState(gameId);
  useEffect(() => {
    if (open && games === null) void listGames().then(setGames).catch(() => setGames([]));
  }, [open, games]);
  const chosen = games?.find((g) => g.id === current);
  const pick = async (id: string) => {
    try {
      await setAdventureGame(activityId, id);
      setCurrent(id);
      setOpen(false);
      toast.success("Game added to this Adventure");
    } catch (e) {
      toast.error((e as Error).message || "Could not add the Game");
    }
  };
  const shown = (games ?? []).filter((g) => (g.name || "Game").toLowerCase().includes(query.toLowerCase()));
  return (
    <>
      <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => setOpen(true)}>
        <Gamepad2 className="mr-1 h-3.5 w-3.5" /> {current ? `Game: ${chosen?.name || "chosen"}` : "Add Game"}
      </Button>
      {open && (
        <Dialog open onOpenChange={setOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader><DialogTitle>Add Game</DialogTitle></DialogHeader>
            <p className="text-xs text-muted-foreground">Its writing surfaces, rewards and sounds play at each learning point. The Adventure video replaces the Game's background.</p>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search Games" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            {games === null ? (
              <div className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading…</div>
            ) : shown.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No Games found.</p>
            ) : (
              <div className="space-y-1.5">
                {shown.map((g) => (
                  <div key={g.id} className="flex items-center gap-2">
                    <Button type="button" variant={g.id === current ? "default" : "outline"} className="flex-1 justify-start" onClick={() => void pick(g.id)}>
                      {g.name || "Game"}
                    </Button>
                    <a href={`/game/play/${g.id}`} target="_blank" rel="noreferrer" className="text-xs text-primary underline">Preview</a>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

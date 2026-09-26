// Teacher — LINK AN ADVENTURE TO A CLASS.
//
// An Adventure is a reusable video experience. Linking it to a class does NOT
// move any question: questions arrive afterwards, one progress bar at a time,
// from the lesson note's Assign → Adventure flow. Unlinking removes only this
// class's use of the adventure.
import { useCallback, useEffect, useState } from "react";
import { Loader2, Sparkles, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import type { GameRow } from "@/lib/games/types";
import { withTimeout } from "@/lib/async/withTimeout";
import type { LinkedAdventure } from "@/lib/adventures/classAdventureLinks";
import {
  linkAdventure,
  listClassAdventures,
  listLinkableAdventures,
} from "@/lib/adventures/classAdventureLinks";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  classId: string;
  onLinked?: () => void;
}

export function LinkAdventureDialog({ open, onOpenChange, classId, onLinked }: Props) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [games, setGames] = useState<GameRow[]>([]);
  const [linked, setLinked] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    // Both reads are independent and time-bounded: a slow or failing link lookup
    // must never leave this picker spinning.
    const [all, mine] = await Promise.allSettled([
      withTimeout(listLinkableAdventures(), 15000),
      withTimeout(listClassAdventures(classId), 15000),
    ]);
    if (all.status === "fulfilled") {
      setGames(all.value);
    } else {
      console.error("Could not load adventures", all.reason);
      toast({
        title: "Could not load your adventures",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
      setGames([]);
    }
    setLinked(
      mine.status === "fulfilled"
        ? new Set((mine.value as LinkedAdventure[]).map((a) => a.gameId))
        : new Set<string>(),
    );
    setLoading(false);
  }, [classId]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  const pick = async (g: GameRow) => {
    if (linked.has(g.id)) return;
    setBusy(g.id);
    try {
      await linkAdventure(classId, g.id);
      setLinked((prev) => new Set(prev).add(g.id));
      onLinked?.();
      toast({ title: "Adventure linked", description: `${g.title} is now available in this class.` });
      onOpenChange(false);
    } catch (e: any) {
      console.error("Could not link Adventure", e);
      toast({
        title: "Could not link Adventure",
        description: e?.name === "AdventureDatabaseError"
          ? e.message
          : "The Adventure relationship could not be created. Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Link Adventure
          </DialogTitle>
        </DialogHeader>

        <p className="pb-1 text-xs text-muted-foreground">
          Pick an adventure you have already built. Questions are assigned later, to its progress bars.
        </p>

        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : games.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No adventures created yet. Build one in the Adventure editor first.
          </div>
        ) : (
          <ul className="max-h-80 space-y-1.5 overflow-y-auto">
            {games.map((g) => {
              const already = linked.has(g.id);
              return (
                <li key={g.id}>
                  <button
                    type="button"
                    disabled={already || busy === g.id}
                    onClick={() => pick(g)}
                    className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm ${
                      already ? "border-border/60 bg-muted/20" : "border-input hover:border-primary/50 hover:bg-accent/50"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{g.title}</div>
                      {g.subtopic && <div className="truncate text-xs text-muted-foreground">{g.subtopic}</div>}
                    </div>
                    {busy === g.id ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                    ) : already ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                        <Check className="h-3.5 w-3.5" /> Linked
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <DialogFooter className="mt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default LinkAdventureDialog;

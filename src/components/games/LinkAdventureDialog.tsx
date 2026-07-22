// Phase 13 — LinkAdventureDialog. Lets a teacher pick an active Adventure
// (lesson note assigned to this class) to jump into its Adventure Dashboard
// for the current game. Additive: no schema changes; just navigation.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { listAdventureNotes, type ClassAdventureNoteRow } from "@/lib/adventures/classAdventures";

export interface LinkAdventureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  gameId: string;
}

const LinkAdventureDialog = ({ open, onOpenChange, classId, gameId }: LinkAdventureDialogProps) => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ClassAdventureNoteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listAdventureNotes(classId).then((data) => {
      setRows(data);
      setSelected(data[0]?.id ?? null);
      setLoading(false);
    });
  }, [open, classId]);

  const onConfirm = () => {
    onOpenChange(false);
    navigate(`/teaching-hub/classes/${classId}/games/${gameId}/dashboard`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link to Adventure</DialogTitle>
          <DialogDescription>
            Pick an active Adventure to open its Dashboard for this game.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-72 overflow-y-auto rounded-md border border-border">
          {loading ? (
            <p className="p-3 text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No active Adventures. Assign a lesson note first.</p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((r) => {
                const isSelected = selected === r.id;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(r.id)}
                      className={`flex w-full items-start justify-between gap-2 p-3 text-left hover:bg-accent ${isSelected ? "bg-accent" : ""}`}
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {r.notebook?.title ?? "Untitled note"}
                          {r.section?.title ? <span className="text-muted-foreground"> · {r.section.title}</span> : null}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {r.notebook?.subject ?? ""}{r.notebook?.subtopic ? ` · ${r.notebook.subtopic}` : ""}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onConfirm} disabled={!selected}>Open Dashboard</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LinkAdventureDialog;

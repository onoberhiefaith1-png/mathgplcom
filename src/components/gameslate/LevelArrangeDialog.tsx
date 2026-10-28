// TEACHER LEVEL ARRANGEMENT — the saved order IS the student's Level order.
// Moving a Level only changes its position: nothing is duplicated or removed.

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ListOrdered } from "lucide-react";
import {
  listGameQuestions,
  reorderQuestions,
  type GameQuestion,
} from "@/lib/slate/gameQuestions";
import {
  updateGameInstanceSettings,
  type GameAssignment,
  type LevelMapStyle,
} from "@/lib/slate/gameAssignments";

interface Props {
  gameId: string;
  classId: string;
  /** Present when a real Class + Game instance owns the play settings. */
  assignment?: GameAssignment | null;
  onClose: () => void;
  onSaved: () => void;
}

export const LevelArrangeDialog = ({ gameId, classId, assignment, onClose, onSaved }: Props) => {
  const [levels, setLevels] = useState<GameQuestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [lockProgression, setLockProgression] = useState(assignment?.lockProgression ?? false);
  const [startingLives, setStartingLives] = useState(assignment?.startingLives ?? 3);
  const [mapStyle, setMapStyle] = useState<LevelMapStyle>(assignment?.levelMapStyle ?? "path");

  useEffect(() => {
    let cancelled = false;
    listGameQuestions(gameId, classId).then((rows) => {
      if (!cancelled) setLevels(rows);
    });
    return () => { cancelled = true; };
  }, [gameId, classId]);

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= levels.length) return;
    setLevels((prev) => {
      const next = [...prev];
      const [row] = next.splice(index, 1);
      next.splice(target, 0, row);
      return next;
    });
  };

  const save = async () => {
    setBusy(true);
    await reorderQuestions(levels.map((l) => l.id));
    if (assignment) {
      await updateGameInstanceSettings(assignment.id, {
        lockProgression, startingLives, levelMapStyle: mapStyle,
      });
    }
    setBusy(false);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <ListOrdered className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Arrange Levels</h2>
        </header>

        <div className="flex-1 overflow-auto p-4">
          <ol className="flex flex-col gap-2">
            {levels.map((level, index) => (
              <li
                key={level.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2"
              >
                <span className="w-16 shrink-0 text-xs font-semibold uppercase text-muted-foreground">
                  Level {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {level.questionText || `Question ${level.position + 1}`}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {level.totalMarks} marks
                </span>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    aria-label="Move up"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="rounded border border-border p-1 disabled:opacity-40"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    onClick={() => move(index, 1)}
                    disabled={index === levels.length - 1}
                    className="rounded border border-border p-1 disabled:opacity-40"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
            {levels.length === 0 && (
              <li className="py-6 text-center text-sm text-muted-foreground">
                No questions have been assigned to this class yet.
              </li>
            )}
          </ol>

          {assignment && (
            <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={lockProgression}
                  onChange={(e) => setLockProgression(e.target.checked)}
                />
                Lock progression — a Level opens only when the one before it is complete
              </label>
              <label className="flex items-center justify-between gap-3 text-sm">
                Starting lives
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={startingLives}
                  onChange={(e) => setStartingLives(Number(e.target.value))}
                  className="w-20 rounded border border-border bg-background px-2 py-1"
                />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm">
                Level map
                <select
                  value={mapStyle}
                  onChange={(e) => setMapStyle(e.target.value as LevelMapStyle)}
                  className="rounded border border-border bg-background px-2 py-1"
                >
                  <option value="path">Winding path</option>
                  <option value="art">Destination cards</option>
                </select>
              </label>
            </div>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save order"}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default LevelArrangeDialog;

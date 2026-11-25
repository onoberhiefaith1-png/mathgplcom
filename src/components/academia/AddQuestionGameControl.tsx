/**
 * One Add Game control for a Floating Numbers question.
 * The same button adds a game or replaces the one already linked.
 */
import { useEffect, useRef, useState } from "react";
import { Activity, Check, Loader2, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  gameActionLabel,
  showAddGameControl,
} from "@/lib/academia/questionGameRules";
import { cn } from "@/lib/utils";

export type AddGameChoice = {
  id: string;
  name: string;
  surface: string;
  preview: string | null;
};

export function AddQuestionGameControl({
  eligible,
  canEdit,
  currentGameId,
  games,
  gamesStatus,
  onReloadGames,
  onSave,
  variant = "toolbar",
}: {
  eligible: boolean;
  canEdit: boolean;
  currentGameId: string | null;
  games: AddGameChoice[] | null;
  gamesStatus: "idle" | "loading" | "ready" | "error";
  onReloadGames: () => void;
  onSave: (gameId: string) => Promise<void>;
  /** toolbar: Smartboard button. menu: the question page's three-dot menu. */
  variant?: "toolbar" | "menu";
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(currentGameId);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setPending(currentGameId);
    setQuery("");
    setError("");
    onReloadGames();
  }, [open, currentGameId, onReloadGames]);

  if (!showAddGameControl({ eligible, canEdit })) return null;

  const actionLabel = gameActionLabel(currentGameId);

  const shown = (games ?? []).filter((game) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return (
      game.name.toLowerCase().includes(needle) ||
      game.surface.toLowerCase().includes(needle)
    );
  });

  const save = async () => {
    if (!pending || pending === currentGameId || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      await onSave(pending);
      setOpen(false);
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : "The game could not be saved. This question is unchanged.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <>
      {variant === "menu" ? (
        <div className="relative">
          <button
            type="button"
            aria-label="Question actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            data-testid="question-game-menu"
            onClick={() => setMenuOpen((value) => !value)}
            className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background/90 text-foreground shadow-sm ring-offset-background hover:border-primary/60 hover:text-primary"
          >
            <MoreVertical className="h-4 w-4" aria-hidden />
          </button>
          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-11 z-20 min-w-40 rounded-xl border border-border bg-card p-1 text-card-foreground shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  setMenuOpen(false);
                  setOpen(true);
                }}
              >
                <Activity className="h-4 w-4" aria-hidden />
                {actionLabel}
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 border-border bg-background px-2.5 text-xs text-foreground hover:border-primary/60 hover:text-primary"
          title="Add Game"
          aria-label="Add Game"
          data-testid="add-game"
          onClick={() => setOpen(true)}
        >
          <Activity className="h-3.5 w-3.5" aria-hidden />
          Add Game
        </Button>
      )}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 sm:items-center">
          <div
            role="dialog"
            aria-labelledby="add-game-title"
            className="relative grid max-h-[85vh] w-full max-w-lg gap-4 overflow-y-auto rounded-lg border border-border bg-background p-6 text-foreground shadow-lg"
          >
            <h2
              id="add-game-title"
              className="text-lg font-semibold leading-none tracking-tight"
            >
              {actionLabel}
            </h2>
            <p className="text-sm text-muted-foreground">
              Choose a game from your dashboard. This question, its Floating
              Numbers and its place in the Session stay the same. Practice keeps
              the Smartboard. Play uses the game you save.
            </p>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search games"
              aria-label="Search games"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background"
            />
            {gamesStatus === "loading" || gamesStatus === "idle" ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading
                games…
              </div>
            ) : gamesStatus === "error" ? (
              <div className="space-y-3 py-4 text-center text-sm" role="alert">
                <p>Your games could not be loaded.</p>
                <Button type="button" variant="outline" onClick={onReloadGames}>
                  Retry
                </Button>
              </div>
            ) : (games ?? []).length === 0 ? (
              <p
                className="py-6 text-center text-sm text-muted-foreground"
                data-testid="add-game-empty"
              >
                There are no available games in your dashboard. Create a game
                there, then come back and add it to this question.
              </p>
            ) : shown.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No games match that search.
              </p>
            ) : (
              <div className="space-y-2">
                {shown.map((game) => {
                  const selected = game.id === pending;
                  const current = game.id === currentGameId;
                  return (
                    <button
                      key={game.id}
                      type="button"
                      data-testid={`game-${game.id}`}
                      aria-pressed={selected}
                      onClick={() => setPending(game.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border bg-card p-2 text-left text-card-foreground transition hover:border-primary/60",
                        selected
                          ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-background"
                          : "border-border",
                      )}
                    >
                      <span
                        className="h-14 w-20 shrink-0 rounded-lg border border-border bg-muted bg-cover bg-center"
                        style={
                          game.preview
                            ? { backgroundImage: `url(${game.preview})` }
                            : undefined
                        }
                        role="img"
                        aria-label={`${game.name} preview`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {game.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {game.surface}
                        </span>
                      </span>
                      {current ? (
                        <span
                          data-testid="current-game"
                          className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
                        >
                          Current
                        </span>
                      ) : null}
                      {selected ? (
                        <Check
                          className="h-4 w-4 shrink-0 text-primary"
                          aria-hidden
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
            {error ? (
              <p
                className="text-sm text-destructive"
                role="alert"
                data-testid="add-game-error"
              >
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                className="absolute right-4 top-4 h-8 px-2"
                onClick={() => setOpen(false)}
                disabled={saving}
                aria-label="Close"
              >
                Close
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                data-testid="save-game"
                onClick={() => void save()}
                disabled={
                  !pending ||
                  pending === currentGameId ||
                  saving ||
                  gamesStatus !== "ready"
                }
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

import { useState } from "react";
import { Gamepad2, Loader2, MoreVertical, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useSignedUrl } from "./SignedMedia";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { normalizeCanvas, type GameRow } from "@/lib/games/types";
import { cn } from "@/lib/utils";

interface GameCardProps {
  game: GameRow;
  coverPending?: boolean;
  onOpen: (id: string) => void;
  onRename: (game: GameRow) => void;
  onRegenerate: (game: GameRow) => void;
  onDelete: (game: GameRow) => void;
}

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const GameCard = ({ game, coverPending, onOpen, onRename, onRegenerate, onDelete }: GameCardProps) => {
  const coverUrl = useSignedUrl(game.thumbnail_path);
  const [imgLoaded, setImgLoaded] = useState(false);
  const sceneCount = normalizeCanvas(game.canvas).scenes.length;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/60 shadow-lg transition duration-200 hover:-translate-y-1 hover:border-primary/60 hover:shadow-primary/20">
      <button
        type="button"
        onClick={() => onOpen(game.id)}
        className="block w-full text-left"
      >
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-gradient-to-br from-secondary/40 via-muted/30 to-background">
          {coverUrl && (
            <img
              src={coverUrl}
              alt={game.title}
              onLoad={() => setImgLoaded(true)}
              className={cn(
                "h-full w-full object-cover transition duration-500 group-hover:scale-105",
                imgLoaded ? "opacity-100" : "opacity-0",
              )}
            />
          )}
          {(!coverUrl || !imgLoaded || coverPending) && (
            <div className="absolute inset-0 grid place-items-center">
              {coverPending ? (
                <div className="flex flex-col items-center gap-2 text-primary/80">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-[11px] uppercase tracking-wide">Conjuring cover…</span>
                </div>
              ) : (
                <Gamepad2 className="h-10 w-10 text-primary/40" />
              )}
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 via-background/50 to-transparent p-3 pt-10">
            <p className="truncate text-sm font-semibold text-foreground">{game.title}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {sceneCount} scene{sceneCount === 1 ? "" : "s"} · {timeAgo(game.updated_at)}
            </p>
          </div>
        </div>
      </button>

      <div className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="grid h-8 w-8 place-items-center rounded-full border border-border/50 bg-background/80 text-foreground backdrop-blur hover:bg-background"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onRename(game)}>
              <Pencil className="mr-2 h-4 w-4" /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRegenerate(game)}>
              <RefreshCw className="mr-2 h-4 w-4" /> Regenerate cover
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(game)}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default GameCard;

import { Layers3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  restoring?: boolean;
  progress?: number;
}

/** The Game stays sealed until its real saved surfaces are ready to use. */
export function GameLoadingScreen({ className, restoring = false, progress = 10 }: Props) {
  const safeProgress = Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <div
      className={cn("game-loading-screen", className)}
      role="status"
      aria-live="polite"
      aria-label={restoring ? "Restoring the Game" : "Loading the Game"}
    >
      <div className="game-loading-vignette" />
      <div className="game-loading-content">
        <div className="game-loading-seal" aria-hidden="true">
          <div className="game-loading-ring game-loading-ring-outer" />
          <div className="game-loading-ring game-loading-ring-inner" />
          <div className="game-loading-relic">
            <span className="game-loading-glow" />
            <Layers3 className="game-loading-icon" strokeWidth={1.2} />
          </div>
          <span className="game-loading-rune game-loading-rune-top">ᛉ</span>
          <span className="game-loading-rune game-loading-rune-right">ᚦ</span>
          <span className="game-loading-rune game-loading-rune-bottom">ᚨ</span>
          <span className="game-loading-rune game-loading-rune-left">ᚱ</span>
        </div>

        <div className="game-loading-copy">
          <h2>{restoring ? "RESTORING" : "LOADING"}<span className="game-loading-dots" aria-hidden="true" /></h2>
          <p>
            {restoring ? "Rebuilding your writing surfaces" : "Preparing your writing surfaces"}
            <strong className="game-loading-percentage">{safeProgress}%</strong>
          </p>
        </div>

        <progress
          className="game-loading-track"
          max={100}
          value={safeProgress}
          aria-label={`Game loading progress: ${safeProgress}%`}
        />
      </div>
    </div>
  );
}
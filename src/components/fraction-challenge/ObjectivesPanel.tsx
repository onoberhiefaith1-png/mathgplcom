// ObjectivesPanel — small progress widget for the right rail.
// Tracks lifetime diamonds + hearts earned vs. the difficulty target.

import { useMathBoard } from "@/hooks/useMathBoard";
import { useFractionGame } from "@/contexts/FractionGameContext";
import { Trophy } from "lucide-react";

const DIAMOND_SRC = "/assets/rewards/diamond/diamond_big.png";
const HEART_SRC = "/assets/ui/icons/heart.png";

export const ObjectivesPanel = () => {
  const { state } = useMathBoard();
  const { objectiveTarget } = useFractionGame();
  const diamondPct = Math.min(100, (state.hud.diamondsEarned / objectiveTarget.diamonds) * 100);
  const heartPct = Math.min(100, (state.hud.heartsEarned / objectiveTarget.hearts) * 100);
  const complete =
    state.hud.diamondsEarned >= objectiveTarget.diamonds &&
    state.hud.heartsEarned >= objectiveTarget.hearts;

  return (
    <div
      className={[
        "rounded-2xl border bg-card/50 p-3 backdrop-blur transition-all",
        complete
          ? "border-emerald-400/60 shadow-[0_0_24px_hsl(150_80%_55%/0.35)]"
          : "border-amber-200/20",
      ].join(" ")}
    >
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="h-3.5 w-3.5 text-amber-300" />
        <span className="text-[10px] uppercase tracking-[0.3em] text-amber-300/80 font-bold">
          Level Goal
        </span>
      </div>
      <ObjectiveRow
        src={DIAMOND_SRC}
        label="Diamonds"
        current={state.hud.diamondsEarned}
        target={objectiveTarget.diamonds}
        pct={diamondPct}
        color="hsl(195_85%_60%)"
      />
      <div className="h-2" />
      <ObjectiveRow
        src={HEART_SRC}
        label="Hearts"
        current={state.hud.heartsEarned}
        target={objectiveTarget.hearts}
        pct={heartPct}
        color="hsl(355_85%_65%)"
      />
      {complete && (
        <div className="mt-3 rounded-lg border border-emerald-400/50 bg-emerald-500/10 px-2 py-1.5 text-center text-[10px] font-black uppercase tracking-widest text-emerald-200 animate-pulse">
          Level Complete!
        </div>
      )}
    </div>
  );
};

const ObjectiveRow = ({
  src, label, current, target, pct, color,
}: { src: string; label: string; current: number; target: number; pct: number; color: string }) => (
  <div className="flex items-center gap-2">
    <img src={src} alt={label} className="h-6 w-6 object-contain drop-shadow-[0_0_8px_hsl(45_90%_60%/0.6)]" />
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between text-[10px] mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums font-bold text-foreground">{current}/{target}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
        <div
          className="h-full transition-all"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}` }}
        />
      </div>
    </div>
  </div>
);

export default ObjectivesPanel;

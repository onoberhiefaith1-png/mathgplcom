import { Settings, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useMathBoard } from "@/hooks/useMathBoard";

const COIN_SRC = "/assets/rewards/coin/gold_coin.png";
const DIAMOND_SRC = "/assets/rewards/diamond/diamond_big.png";
const HEART_SRC = "/assets/ui/icons/heart.png";

export interface ObjectiveCaps {
  diamonds: number;
  hearts: number;
}

export const TopHud = ({
  onSettings,
  backTo,
  rightSlot,
  centerSlot,
  objectives,
}: {
  onSettings: () => void;
  backTo?: string;
  /** Optional element shown next to the title (e.g. timer). */
  rightSlot?: React.ReactNode;
  /** Optional element shown centered (e.g. workspace tabs in smart-board mode). */
  centerSlot?: React.ReactNode;
  /** When provided, diamond/heart show as `earned/target` instead of balance. */
  objectives?: ObjectiveCaps;
}) => {
  const { state } = useMathBoard();
  const { hud } = state;
  const isSmart = state.mode === "smartboard";
  const diamondDisplay = objectives
    ? `${hud.diamondsEarned}/${objectives.diamonds}`
    : hud.diamonds.toLocaleString();
  const heartDisplay = objectives
    ? `${hud.heartsEarned}/${objectives.hearts}`
    : hud.hearts.toLocaleString();
  return (
    <div className="flex items-center justify-between gap-4 border-b border-amber-200/15 bg-card/40 px-5 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        {backTo && (
          <Link
            to={backTo}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-200/30 bg-background/40 text-amber-200 hover:text-amber-300 hover:bg-background/60 transition"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        )}
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-violet-500 text-2xl font-black text-background shadow-[0_0_24px_hsl(45_90%_55%/0.5)]">M</div>
        <div className="leading-tight">
          <div className="text-lg font-bold text-foreground">MathBoard</div>
          <div className="text-xs text-muted-foreground">{isSmart ? "Smart Board" : "Universal Mathematics Workspace"}</div>
        </div>
        {rightSlot && <div className="ml-3">{rightSlot}</div>}
      </div>
      {centerSlot && <div className="flex-1 flex justify-center">{centerSlot}</div>}
      <div className="flex items-center gap-2">
        {!isSmart && <>
          <Stat target="coin" src={COIN_SRC} value={hud.coins.toLocaleString()} />
          <Stat target="diamond" src={DIAMOND_SRC} value={diamondDisplay} />
          <Stat target="heart" src={HEART_SRC} value={heartDisplay} />
          <div className="flex items-center gap-2 rounded-full border border-amber-200/30 bg-background/40 px-3 py-1.5">
            <span className="text-xs text-muted-foreground">Level</span>
            <span className="text-sm font-bold text-amber-200">{hud.level}</span>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted/40">
              <div className="h-full bg-amber-300 transition-all" style={{ width: `${(hud.xp / 200) * 100}%` }} />
            </div>
          </div>
        </>}
        <button onClick={onSettings} className="rounded-full border border-amber-200/30 bg-background/40 p-2 text-amber-200 hover:text-amber-300">
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

const Stat = ({ src, value, target }: { src: string; value: string; target: string }) => (
  <div
    data-hud-target={target}
    className="flex items-center gap-1.5 rounded-full border border-amber-200/30 bg-background/40 px-3 py-1.5"
  >
    <img src={src} alt="" className="h-6 w-6 object-contain drop-shadow-[0_0_8px_hsl(45_90%_60%/0.6)]" />
    <span className="text-sm font-bold text-foreground tabular-nums">{value}</span>
  </div>
);

export default TopHud;

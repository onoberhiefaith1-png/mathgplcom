import { RewardSlot } from "@/lib/mathboard/session";

const SRC: Record<RewardSlot["kind"], string> = {
  coin: "/assets/rewards/coin/gold_coin.png",
  diamond: "/assets/rewards/diamond/diamond_big.png",
  crown: "/assets/ui/icons/crown.png",
  heart: "/assets/ui/icons/heart.png",
};

export const RewardStrip = ({ rewards, glowing }: { rewards: RewardSlot[]; glowing?: boolean }) => {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-amber-300/20 bg-background/30 px-3 py-1.5">
      {rewards.map((r, i) => (
        <img
          key={i}
          src={SRC[r.kind]}
          alt={r.kind}
          data-reward-kind={r.kind}
          className={[
            "h-7 w-7 object-contain transition-all drop-shadow-[0_0_10px_hsl(45_95%_60%/0.7)]",
            r.unlocked && glowing ? "animate-tile-pop" : "",
          ].join(" ")}
        />
      ))}
    </div>
  );
};

export default RewardStrip;

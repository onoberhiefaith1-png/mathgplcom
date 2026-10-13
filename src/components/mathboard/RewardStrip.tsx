import { RewardSlot } from "@/lib/mathboard/session";

const SRC: Record<RewardSlot["kind"], string> = {
  coin: "/__l5e/assets-v1/26b4d3d5-f2a5-494a-a9e3-0fa684d8531e/gold_coin.png",
  diamond: "/__l5e/assets-v1/07faa783-e557-42f3-84e8-b7a5d2fd8ae5/diamond_big.png",
  crown: "/__l5e/assets-v1/02b6087b-0fdc-4346-b4d2-040b9dc72d5e/crown.png",
  heart: "/__l5e/assets-v1/c18328de-ad76-4c8b-a8d4-e86c0deabf0b/heart.png",
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

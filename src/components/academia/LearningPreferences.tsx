import { GraduationCap, Hash } from "lucide-react";
import TierPicker from "@/components/academia/TierPicker";
import FloatingNumberSizeControl from "@/components/smartboard/FloatingNumberSizeControl";
import { useDefaultTier } from "@/hooks/useDefaultTier";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Learning preferences (next-edition §4 + §8/§9): the default tier new
 * Sessions open on, and the Floating Number Size with a live preview.
 * `account` mirrors the default tier to the signed-in MathGPL account
 * (website); Mathemagine passes false and keeps it on the device.
 */
const LearningPreferences = ({ account = false, preview, className = "" }: {
  account?: boolean;
  preview?: "phone" | "board";
  className?: string;
}) => {
  const { tier, setTier } = useDefaultTier({ account });
  // Preview the strip the learner will actually see on this device (§9).
  const isPhone = useIsMobile();
  return (
    <div className={`space-y-5 ${className}`}>
      <section aria-label="Default tier">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><GraduationCap className="h-4 w-4 opacity-70" /> Default tier</h3>
        <TierPicker
          label="Sessions open on"
          value={tier}
          onChange={setTier}
          hint="Beginner unless you choose otherwise. Switch any time with the tier selector at the top right of a Session."
        />
      </section>
      <section aria-label="Floating Number Size">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Hash className="h-4 w-4 opacity-70" /> Floating Number Size</h3>
        <FloatingNumberSizeControl preview={preview ?? (isPhone ? "phone" : "board")} />
      </section>
    </div>
  );
};

export default LearningPreferences;

import { cn } from "@/lib/utils";

interface Props {
  whole: number | string;
  num: number | string;
  den: number | string;
  /** Tailwind text size for the WHOLE number; the stack auto-scales to half. */
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZES = {
  sm: { whole: "text-xl", small: "text-[0.6rem]", gap: "gap-1", barW: "w-3" },
  md: { whole: "text-3xl", small: "text-sm", gap: "gap-1.5", barW: "w-5" },
  lg: { whole: "text-4xl", small: "text-lg", gap: "gap-2", barW: "w-6" },
  xl: { whole: "text-5xl", small: "text-xl", gap: "gap-2", barW: "w-8" },
};

/** Mathematical mixed-number rendering: 3 1/5 with the fraction stack
 *  approximately half the height of the whole number, perfectly straight bar,
 *  small but clear gap between whole and stack. */
export const MixedNumberView = ({ whole, num, den, size = "md", className }: Props) => {
  const s = SIZES[size];
  return (
    <span className={cn("inline-flex items-center font-black tabular-nums leading-none", s.gap, className)}>
      <span className={s.whole}>{whole}</span>
      <span className="inline-flex flex-col items-center leading-none">
        <span className={cn(s.small)}>{num}</span>
        <span className={cn("h-px bg-current my-0.5", s.barW)} />
        <span className={cn(s.small)}>{den}</span>
      </span>
    </span>
  );
};

/** Plain stacked fraction (no whole number). */
export const FractionView = ({
  num,
  den,
  size = "md",
  className,
}: {
  num: number | string;
  den: number | string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) => {
  const s = SIZES[size];
  return (
    <span className={cn("inline-flex flex-col items-center font-black tabular-nums leading-none", className)}>
      <span className={s.whole}>{num}</span>
      <span className={cn("h-px bg-current my-0.5", "w-8")} />
      <span className={s.whole}>{den}</span>
    </span>
  );
};

export default MixedNumberView;

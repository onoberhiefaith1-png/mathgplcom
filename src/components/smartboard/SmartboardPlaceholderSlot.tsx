import type { PointerEvent as RPointerEvent } from "react";
import { smartboardPlaceholderStyle, type PlaceholderSlotSize } from "@/lib/smartboard/placeholderColor";

interface Props {
  color: string;
  active?: boolean;
  caretColor?: string;
  size?: PlaceholderSlotSize;
  source?: string;
  onPointerDown?: (e: RPointerEvent<HTMLSpanElement>) => void;
}

export const SmartboardPlaceholderSlot = ({
  color,
  active = false,
  caretColor,
  size = "inline",
  source = "slot",
  onPointerDown,
}: Props) => (
  <span
    data-sb-placeholder={source}
    onPointerDown={onPointerDown}
    style={smartboardPlaceholderStyle(color, { size, active, caretColor })}
  >
    {active && caretColor ? (
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: 2,
          height: "0.85em",
          borderRadius: 1,
          background: caretColor,
          boxShadow: `0 0 6px ${caretColor}aa`,
        }}
      />
    ) : null}
  </span>
);

export default SmartboardPlaceholderSlot;
// WritingSensor — soft pulsing caret marking the active writing position
// on the Smartboard's invisible mathematical grid. Scales with zoom so it
// always previews the size of the next character.

import { caretPosition, type Grid, type GridPoint } from "@/lib/smartboard/grid";

interface Props {
  point: GridPoint;
  inkColor: string;
  grid: Grid;
}

export const WritingSensor = ({ point, inkColor, grid }: Props) => {
  const { top, left, height } = caretPosition(point, grid);
  const w = Math.max(2, grid.CARET_HEIGHT * 0.045);
  return (
    <div
      aria-hidden
      className="sb-sensor"
      style={{
        position: "absolute",
        top,
        left,
        width: w,
        height,
        background: inkColor,
        borderRadius: w / 2,
        boxShadow: `0 0 ${6 + height * 0.1}px ${inkColor}aa, 0 0 ${12 + height * 0.2}px ${inkColor}55`,
        pointerEvents: "none",
      }}
    />
  );
};

export default WritingSensor;

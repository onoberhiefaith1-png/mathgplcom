import { useId, type ReactNode } from "react";
import type { VennSet } from "./types";

interface RegionShapeProps {
  regionKey: string;
  sets: VennSet[];
  width: number;
  height: number;
  fill: string;
  fillOpacity: number;
  className?: string;
  emphasized?: boolean;
}

/**
 * Paint one exact physical Venn region.
 *
 * A region key lists every set containing the point. For example, "AB" means
 * inside A and B but outside C. Nested clip paths intersect the included discs;
 * a mask subtracts every excluded disc. The empty key is the universal area
 * outside every visible set.
 */
export function VennRegionShape({
  regionKey,
  sets,
  width,
  height,
  fill,
  fillOpacity,
  className,
  emphasized = false,
}: RegionShapeProps) {
  const rawId = useId().replace(/:/g, "");
  const inside = new Set(regionKey.split(""));
  const insideSets = sets.filter((set) => inside.has(set.id));
  const outsideSets = sets.filter((set) => !inside.has(set.id));
  const maskId = `venn-region-mask-${rawId}`;
  const clipIds = insideSets.slice(1).map((_, index) => `venn-region-clip-${rawId}-${index}`);

  let includedShape: ReactNode;
  if (insideSets.length === 0) {
    includedShape = <rect x={0} y={0} width={width} height={height} fill="white" />;
  } else {
    const first = insideSets[0];
    if (!first) return null;
    includedShape = <circle cx={first.cx} cy={first.cy} r={first.radius} fill="white" />;
    for (let index = insideSets.length - 1; index >= 1; index -= 1) {
      includedShape = <g clipPath={`url(#${clipIds[index - 1]})`}>{includedShape}</g>;
    }
  }

  return (
    <g className={className} pointerEvents="none">
      <defs>
        {insideSets.slice(1).map((set, index) => (
          <clipPath id={clipIds[index]} key={clipIds[index]}>
            <circle cx={set.cx} cy={set.cy} r={set.radius} />
          </clipPath>
        ))}
        <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={height}>
          <rect x={0} y={0} width={width} height={height} fill="black" />
          {includedShape}
          {outsideSets.map((set) => (
            <circle key={set.id} cx={set.cx} cy={set.cy} r={set.radius} fill="black" />
          ))}
        </mask>
      </defs>
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill={fill}
        fillOpacity={fillOpacity}
        mask={`url(#${maskId})`}
        filter={emphasized ? "url(#venn-focus-glow)" : undefined}
      />
    </g>
  );
}
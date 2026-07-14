// Abacus asset — thin wrapper around the game Abacus so it can be dropped
// inside lesson notes as a manipulative. Editing (reset, etc.) lives in
// the right-hand Properties Panel.

import { useCallback, useMemo } from "react";
import { Abacus, type AbacusDigits } from "@/components/abacus/Abacus";
import { useRegisterAssetEditor } from "@/hooks/useAssetSelection";
import {
  PanelGroup, PanelRow, PanelToggle, PanelButton,
} from "@/components/lessonnotes/panel/panelPrimitives";

interface Props {
  attrs: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  selected?: boolean;
}

function normalize(a: Record<string, unknown>): AbacusDigits {
  const d = (a.digits && typeof a.digits === "object") ? a.digits as Partial<AbacusDigits> : {};
  const n = (v: unknown) => {
    const x = Number(v); return Number.isFinite(x) && x >= 0 && x <= 9 ? Math.floor(x) : 0;
  };
  return { th: n(d.th), h: n(d.h), t: n(d.t), u: n(d.u) };
}

export function AbacusAsset({ attrs, onChange, selected }: Props) {
  const digits = useMemo(() => normalize(attrs), [attrs]);
  const set = useCallback((next: AbacusDigits) => onChange({ digits: next }), [onChange]);
  const showValue = attrs.showValue === undefined ? true : Boolean(attrs.showValue);
  const showLabels = attrs.showLabels === undefined ? true : Boolean(attrs.showLabels);

  const numericValue = digits.th * 1000 + digits.h * 100 + digits.t * 10 + digits.u;

  const editor = (
    <div>
      <PanelGroup label="Display">
        <PanelRow label="Place value labels">
          <PanelToggle value={showLabels} onChange={(v) => onChange({ showLabels: v })} />
        </PanelRow>
        <PanelRow label="Show numeric value">
          <PanelToggle value={showValue} onChange={(v) => onChange({ showValue: v })} />
        </PanelRow>
      </PanelGroup>
      <PanelGroup label="Actions">
        <PanelButton full onClick={() => set({ th: 0, h: 0, t: 0, u: 0 })}>Reset</PanelButton>
      </PanelGroup>
      <PanelGroup label="Value">
        <div className="text-lg font-semibold tabular-nums text-foreground">{numericValue}</div>
      </PanelGroup>
    </div>
  );
  useRegisterAssetEditor(!!selected, "abacusManipulative", "Abacus", editor);

  return (
    <div className="not-prose inline-block" style={{ transform: "scale(0.75)", transformOrigin: "top left" }}>
      <Abacus
        digits={digits}
        enabled={{ th: true, h: true, t: true, u: true }}
        onChange={set}
      />
      {showValue && (
        <div className="mt-1 text-center text-sm font-semibold tabular-nums text-foreground">
          {numericValue}
        </div>
      )}
    </div>
  );
}

export default AbacusAsset;

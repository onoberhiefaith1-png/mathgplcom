// SolidEngineNode — tiptap-facing wrapper mirroring CircleEngineNode.

import { useEffect, useMemo, useState } from "react";
import { SolidEngineCanvas } from "./SolidEngineCanvas";
import { SolidEnginePanel } from "./SolidEnginePanel";
import { buildSolidPreset } from "./presets";
import type { UCESolidModel } from "./types";
import { normalizeMeasurements } from "./types";

interface Props {
  variant: string;
  attrs: Record<string, unknown>;
  selected: boolean;
  editorOpen: boolean;
  onCloseEditor: () => void;
  onChange: (patch: Record<string, unknown>) => void;
  onDeleteDiagram?: () => void;
}

export function SolidEngineNode({ variant, attrs, selected, editorOpen, onCloseEditor, onChange, onDeleteDiagram }: Props) {
  const initial = useMemo<UCESolidModel>(() => {
    const m = attrs.model as UCESolidModel | undefined;
    if (m && Array.isArray(m.solids) && m.solids.length > 0) {
      // Migrate legacy boolean measurements to { enabled, value }.
      return {
        ...m,
        solids: m.solids.map((s) => ({ ...s, measurements: normalizeMeasurements(s.measurements) })),
      };
    }
    const preset = (attrs.preset as string) || variant || "cube";
    return buildSolidPreset(preset);
  }, [attrs, variant]);

  const [model, setModel] = useState<UCESolidModel>(initial);
  const [selection, setSelection] = useState<string[]>([]);

  useEffect(() => {
    if (!attrs.model) onChange({ model: initial });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = (m: UCESolidModel) => {
    setModel(m);
    onChange({ model: m });
  };

  return (
    <span
      className="relative inline-block align-middle"
      style={{ overflow: "visible" }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <span className="block rounded">
        <SolidEngineCanvas
          model={model}
          selection={selection}
          onSelectionChange={setSelection}
          onChange={commit}
          editable={selected || editorOpen}
        />
      </span>

      <SolidEnginePanel
        open={editorOpen}
        onClose={onCloseEditor}
        model={model}
        selection={selection}
        onChange={commit}
        onDeleteDiagram={onDeleteDiagram}
      />
    </span>
  );
}

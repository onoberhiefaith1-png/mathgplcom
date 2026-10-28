// LineEngineNode — tiptap-facing wrapper. The parent (LivingDiagram)
// owns edit-mode state and drives it through the shared ⚙ Edit chip in
// SelectionFrame, so this component renders only the canvas + panel.

import { useEffect, useMemo, useState } from "react";
import { LineEngineCanvas } from "./LineEngineCanvas";
import { LineEnginePanel } from "./LineEnginePanel";
import { buildPreset } from "./presets";
import type { ULEModel } from "./types";

interface Props {
  variant: string;
  attrs: Record<string, unknown>;
  selected: boolean;
  editorOpen: boolean;
  onCloseEditor: () => void;
  onChange: (patch: Record<string, unknown>) => void;
  onDeleteDiagram?: () => void;
}

export function LineEngineNode({ variant, attrs, selected, editorOpen, onCloseEditor, onChange, onDeleteDiagram }: Props) {
  const initial = useMemo<ULEModel>(() => {
    const m = attrs.model as ULEModel | undefined;
    if (m && Array.isArray(m.lines) && m.lines.length > 0) return m;
    const preset = (attrs.preset as string) || variant || "lineSegment";
    return buildPreset(preset);
  }, [attrs, variant]);

  const [model, setModel] = useState<ULEModel>(initial);
  const [selection, setSelection] = useState<string[]>([]);

  useEffect(() => {
    if (!attrs.model) onChange({ model: initial });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = (m: ULEModel) => {
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
        <LineEngineCanvas
          model={model}
          selection={selection}
          onSelectionChange={setSelection}
          onChange={commit}
          editable={selected || editorOpen}
        />
      </span>

      <LineEnginePanel
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

// CircleEngineNode — tiptap-facing wrapper mirroring LineEngineNode.
// Edit mode is driven by the shared ⚙ Edit chip on SelectionFrame.

import { useEffect, useMemo, useState } from "react";
import { CircleEngineCanvas } from "./CircleEngineCanvas";
import { CircleEnginePanel } from "./CircleEnginePanel";
import { buildPreset } from "./presets";
import type { UCEModel } from "./types";

interface Props {
  variant: string;
  attrs: Record<string, unknown>;
  selected: boolean;
  editorOpen: boolean;
  onCloseEditor: () => void;
  onChange: (patch: Record<string, unknown>) => void;
  onDeleteDiagram?: () => void;
}

export function CircleEngineNode({ variant, attrs, selected, editorOpen, onCloseEditor, onChange, onDeleteDiagram }: Props) {
  const initial = useMemo<UCEModel>(() => {
    const m = attrs.model as UCEModel | undefined;
    if (m && Array.isArray(m.circles) && m.circles.length > 0) return m;
    const preset = (attrs.preset as string) || variant || "circle";
    return buildPreset(preset);
  }, [attrs, variant]);

  const [model, setModel] = useState<UCEModel>(initial);
  const [selection, setSelection] = useState<string[]>([]);

  useEffect(() => {
    if (!attrs.model) onChange({ model: initial });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = (m: UCEModel) => {
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
        <CircleEngineCanvas
          model={model}
          selection={selection}
          onSelectionChange={setSelection}
          onChange={commit}
          editable={selected || editorOpen}
        />
      </span>

      <CircleEnginePanel
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

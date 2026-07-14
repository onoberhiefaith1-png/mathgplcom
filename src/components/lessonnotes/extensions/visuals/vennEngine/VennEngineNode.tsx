// VennEngineNode — tiptap wrapper mirroring CircleEngineNode.

import { useEffect, useMemo, useState } from "react";
import { VennEngineCanvas } from "./VennEngineCanvas";
import { VennEnginePanel } from "./VennEnginePanel";
import { buildVennPreset } from "./presets";
import type { UCEVennModel } from "./types";

interface Props {
  variant: string;
  attrs: Record<string, unknown>;
  selected: boolean;
  editorOpen: boolean;
  onCloseEditor: () => void;
  onChange: (patch: Record<string, unknown>) => void;
  onDeleteDiagram?: () => void;
}

export function VennEngineNode({ variant, attrs, selected, editorOpen, onCloseEditor, onChange, onDeleteDiagram }: Props) {
  const initial = useMemo<UCEVennModel>(() => {
    const m = attrs.model as UCEVennModel | undefined;
    if (m && Array.isArray(m.sets) && m.sets.length > 0) return m;
    const preset = (attrs.preset as string) || variant || "venn2";
    return buildVennPreset(preset);
  }, [attrs, variant]);

  const [model, setModel] = useState<UCEVennModel>(initial);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedSet, setSelectedSet] = useState<string | null>(null);

  useEffect(() => {
    if (!attrs.model) onChange({ model: initial });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = (m: UCEVennModel) => {
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
        <VennEngineCanvas
          model={model}
          selectedRegion={selectedRegion}
          selectedSet={selectedSet}
          onSelectRegion={setSelectedRegion}
          onSelectSet={setSelectedSet}
          onChange={commit}
          editable={selected || editorOpen}
        />
      </span>

      <VennEnginePanel
        open={editorOpen}
        onClose={onCloseEditor}
        model={model}
        selectedRegion={selectedRegion}
        selectedSet={selectedSet}
        onChange={commit}
        onSelectSet={setSelectedSet}
        onSelectRegion={setSelectedRegion}
        onDeleteDiagram={onDeleteDiagram}
      />
    </span>
  );
}

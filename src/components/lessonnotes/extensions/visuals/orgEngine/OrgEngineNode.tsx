import { useEffect, useMemo, useState } from "react";
import { OrgEngineCanvas } from "./OrgEngineCanvas";
import { OrgEnginePanel } from "./OrgEnginePanel";
import { buildOrgPreset } from "./presets";
import type { OrgModel } from "./types";

interface Props {
  variant: string;
  attrs: Record<string, unknown>;
  selected: boolean;
  editorOpen: boolean;
  onCloseEditor: () => void;
  onChange: (patch: Record<string, unknown>) => void;
  onDeleteDiagram?: () => void;
}

export function OrgEngineNode({ variant, attrs, selected, editorOpen, onCloseEditor, onChange, onDeleteDiagram }: Props) {
  const initial = useMemo<OrgModel>(() => {
    const m = attrs.model as OrgModel | undefined;
    if (m && m.root) return m;
    return buildOrgPreset((attrs.preset as string) || variant || "mindmap");
  }, [attrs, variant]);

  const [model, setModel] = useState<OrgModel>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!attrs.model) onChange({ model: initial });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = (m: OrgModel) => { setModel(m); onChange({ model: m }); };

  return (
    <span className="relative inline-block align-middle" style={{ overflow: "visible", width: "100%", maxWidth: 640 }}
      onPointerDown={(e) => e.stopPropagation()}>
      <span className="block rounded">
        <OrgEngineCanvas
          model={model}
          selectedId={selectedId}
          onSelect={setSelectedId}
          editable={selected || editorOpen}
        />
      </span>
      <OrgEnginePanel
        open={editorOpen}
        onClose={onCloseEditor}
        model={model}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onChange={commit}
        onDeleteDiagram={onDeleteDiagram}
      />
    </span>
  );
}

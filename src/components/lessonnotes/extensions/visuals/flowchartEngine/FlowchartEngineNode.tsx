import { useEffect, useMemo, useState } from "react";
import { FlowchartEngineCanvas } from "./FlowchartEngineCanvas";
import { FlowchartEnginePanel } from "./FlowchartEnginePanel";
import { buildFlowPreset } from "./presets";
import type { FlowModel } from "./types";
import { newId } from "./types";

interface Props {
  variant: string;
  attrs: Record<string, unknown>;
  selected: boolean;
  editorOpen: boolean;
  onCloseEditor: () => void;
  onChange: (patch: Record<string, unknown>) => void;
  onDeleteDiagram?: () => void;
}

export function FlowchartEngineNode({ variant, attrs, selected, editorOpen, onCloseEditor, onChange, onDeleteDiagram }: Props) {
  const initial = useMemo<FlowModel>(() => {
    const m = attrs.model as FlowModel | undefined;
    if (m && Array.isArray(m.nodes)) return m;
    return buildFlowPreset((attrs.preset as string) || variant || "flowBlank");
  }, [attrs, variant]);

  const [model, setModel] = useState<FlowModel>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);

  useEffect(() => {
    if (!attrs.model) onChange({ model: initial });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = (m: FlowModel) => { setModel(m); onChange({ model: m }); };

  const handleConnect = (from: string, to: string) => {
    if (from === to) return setConnectFrom(null);
    commit({ ...model, edges: [...model.edges, { id: newId("e"), from, to, style: "orthogonal", arrow: true, label: "" }] });
    setConnectFrom(null);
  };

  return (
    <span className="relative inline-block align-middle" style={{ overflow: "visible", width: "100%", maxWidth: 640 }}
      onPointerDown={(e) => e.stopPropagation()}>
      <span className="block rounded">
        <FlowchartEngineCanvas
          model={model}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onChange={commit}
          editable={selected || editorOpen}
          connectFrom={connectFrom}
          onConnect={handleConnect}
        />
      </span>
      <FlowchartEnginePanel
        open={editorOpen}
        onClose={onCloseEditor}
        model={model}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onChange={commit}
        connectFrom={connectFrom}
        onSetConnectFrom={setConnectFrom}
        onDeleteDiagram={onDeleteDiagram}
      />
    </span>
  );
}

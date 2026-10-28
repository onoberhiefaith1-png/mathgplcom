import { useEffect, useMemo, useState } from "react";
import { TreeEngineCanvas } from "./TreeEngineCanvas";
import { TreeEnginePanel } from "./TreeEnginePanel";
import { buildTreePreset } from "./presets";
import type { TreeModel } from "./types";

interface Props {
  variant: string;
  attrs: Record<string, unknown>;
  selected: boolean;
  editorOpen: boolean;
  onCloseEditor: () => void;
  onChange: (patch: Record<string, unknown>) => void;
  onDeleteDiagram?: () => void;
}

export function TreeEngineNode({ variant, attrs, selected, editorOpen, onCloseEditor, onChange, onDeleteDiagram }: Props) {
  const initial = useMemo<TreeModel>(() => {
    const m = attrs.model as TreeModel | undefined;
    if (m && m.root) return m;
    const preset = (attrs.preset as string) || variant || "tree2";
    return buildTreePreset(preset);
  }, [attrs, variant]);

  const [model, setModel] = useState<TreeModel>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!attrs.model) onChange({ model: initial });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = (m: TreeModel) => {
    setModel(m);
    onChange({ model: m });
  };

  const handleAddChild = (id: string) => {
    // Delegated to panel; also expose direct + button on canvas.
    import("./layout").then(({ cloneTree, findNode }) => {
      import("./types").then(({ DEFAULT_BRANCH, newNodeId }) => {
        const next = cloneTree(model.root);
        const n = findNode(next, id);
        if (!n) return;
        n.children.push({
          id: newNodeId(),
          label: `n${n.children.length + 1}`,
          prob: "", expr: "", color: model.defaults.color,
          size: model.defaults.size, revealed: true,
          branch: DEFAULT_BRANCH(),
          children: [],
        });
        commit({ ...model, root: next });
      });
    });
  };

  const handleDelete = (id: string) => {
    if (id === model.root.id) return;
    import("./layout").then(({ cloneTree, findParent }) => {
      const next = cloneTree(model.root);
      const p = findParent(next, id);
      if (!p) return;
      p.children = p.children.filter((c) => c.id !== id);
      setSelectedId(null);
      commit({ ...model, root: next });
    });
  };

  return (
    <span className="relative inline-block align-middle" style={{ overflow: "visible" }}
      onPointerDown={(e) => e.stopPropagation()}>
      <span className="block rounded">
        <TreeEngineCanvas
          model={model}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onAddChild={handleAddChild}
          onDelete={handleDelete}
          editable={selected || editorOpen}
        />
      </span>

      <TreeEnginePanel
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

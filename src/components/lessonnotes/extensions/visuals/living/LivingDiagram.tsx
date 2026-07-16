// Bridges the tiptap mathVisual node to LivingCanvas + PropertyPanel.
// Owns selectedComponentId (the currently-edited component). Selection
// null = the whole diagram is being edited.

import { useEffect, useMemo, useState } from "react";
import { renderVisual } from "../visualDispatch";
import { LivingCanvas, type FreeLabel, type PickTool, type PickedPoint } from "./LivingCanvas";
import { SmartTable } from "../smarttable/SmartTable";
import { SmartChart } from "../smartchart/SmartChart";
import { PlaceValueChart } from "../arithmetic/PlaceValueChart";
import { LongDivision } from "../arithmetic/LongDivision";
import { DivisionLadder } from "../arithmetic/DivisionLadder";
import { BaseConversion } from "../arithmetic/BaseConversion";
import { FractionWall } from "../arithmetic/FractionWall";
import { FractionStrip } from "../arithmetic/FractionStrip";
import { Base10Blocks } from "../arithmetic/Base10Blocks";
import { AbacusAsset } from "../arithmetic/AbacusAsset";
import { CoordinatePlane } from "../coord/CoordinatePlane";
import { LineEngineNode } from "../lineEngine/LineEngineNode";
import { CircleEngineNode } from "../circleEngine/CircleEngineNode";
import { SolidEngineNode } from "../solidEngine/SolidEngineNode";
import { VennEngineNode } from "../vennEngine/VennEngineNode";
import { TreeEngineNode } from "../treeEngine/TreeEngineNode";
import { FlowchartEngineNode } from "../flowchartEngine/FlowchartEngineNode";
import { OrgEngineNode } from "../orgEngine/OrgEngineNode";

import { SelectionFrame } from "./SelectionFrame";
import { PropertyPanel } from "./panel/PropertyPanel";
import { getAdapter } from "./shapes";
import { getAttrsAdapter } from "./attrsAdapters";
import type { Nodes } from "./geometry";
import type { LiveComponent, Visibility } from "./schema";
import { decompose, newComponentId, type Component } from "./panel/componentModel";

interface Props {
  variant: string;
  family: string;
  attrs: Record<string, unknown>;
  assetId?: string;
  selected: boolean;
  onChange: (patch: Record<string, unknown>) => void;
  onDeleteDiagram?: () => void;
}

export function LivingDiagram({ variant, family, attrs, assetId, selected, onChange, onDeleteDiagram }: Props) {
  const editorOwnerId = assetId || `${family}:${variant}`;
  const geoAdapter = useMemo(
    () => (family === "shape" ? getAdapter(variant) : null),
    [family, variant],
  );
  const attrsAdapter = useMemo(() => getAttrsAdapter(family), [family]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [pickMode, setPickMode] = useState<PickTool | null>(null);

  const labels: FreeLabel[] = Array.isArray(attrs.labels) ? (attrs.labels as FreeLabel[]) : [];
  const nodeLabels = (attrs.nodeLabels as Record<string, string>) ?? {};
  const visibility = (attrs.visibility as Visibility) ?? {};
  const viewScale = Number(attrs.viewScale) || 1;
  const addOnComponents: LiveComponent[] = Array.isArray(attrs.components)
    ? (attrs.components as LiveComponent[]) : [];

  const nodes: Nodes | null = geoAdapter
    ? ((attrs.nodes as Nodes | undefined) ?? geoAdapter.initialNodes)
    : null;

  // Decompose the diagram lazily. Stored in attrs.parts so it persists
  // with the document (kept separate from legacy attrs.components which
  // are Add-Component add-ons).
  const storedParts: Component[] = Array.isArray(attrs.parts) ? (attrs.parts as Component[]) : [];
  const parts: Component[] = storedParts.map((part) => {
    if (part.kind !== "vertex" || !part.nodes?.[0]) return part;
    const nodeName = part.nodes[0];
    return {
      ...part,
      content: {
        ...part.content,
        label: nodeLabels[nodeName] ?? part.content?.label ?? nodeName,
      },
    };
  });
  useEffect(() => {
    if (storedParts.length === 0 && nodes && geoAdapter) {
      const initial = decompose(variant, nodes);
      if (initial.length > 0) onChange({ parts: initial });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, geoAdapter, storedParts.length]);

  const announceEditorOpen = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("lessonnotes:asset-editor-open", {
      detail: { assetId: editorOwnerId },
    }));
  };
  const openEditor = () => { announceEditorOpen(); setEditorOpen(true); };
  const toggleEditor = () => {
    setEditorOpen((open) => {
      const next = !open;
      if (next) announceEditorOpen();
      return next;
    });
  };
  const closeEditor = () => { setEditorOpen(false); setSelectedComponentId(null); setPickMode(null); };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOtherEditorOpen = (event: Event) => {
      const otherId = (event as CustomEvent<{ assetId?: string }>).detail?.assetId;
      if (otherId && otherId !== editorOwnerId) closeEditor();
    };
    window.addEventListener("lessonnotes:asset-editor-open", onOtherEditorOpen);
    return () => window.removeEventListener("lessonnotes:asset-editor-open", onOtherEditorOpen);
  }, [editorOwnerId]);

  const nextNodeName = (existing: Set<string>): string => {
    let name = "P"; let i = 1;
    while (existing.has(name)) { name = `P${i++}`; }
    return name;
  };

  const commitPick = (tool: PickTool, picks: PickedPoint[]) => {
    if (!nodes) { setPickMode(null); return; }
    const nextNodes: Nodes = { ...nodes };
    const nextParts: Component[] = [...parts];
    const used = new Set(Object.keys(nextNodes));
    const names: string[] = [];
    for (const pk of picks) {
      if (pk.existing) { names.push(pk.existing); continue; }
      const n = nextNodeName(used);
      used.add(n);
      nextNodes[n] = { x: pk.x, y: pk.y };
      nextParts.push({
        id: newComponentId("v"), kind: "vertex", nodes: [n],
        appearance: { color: "currentColor" },
        behaviour: { visible: true, locked: false },
        content: { label: n },
      });
      names.push(n);
    }
    if (tool === "segment" && names.length === 2) {
      nextParts.push({
        id: newComponentId("ln"), kind: "line", nodes: [names[0], names[1]],
        appearance: { color: "#3b82f6", thickness: 2, dash: "dashed" },
        behaviour: { visible: true, locked: false },
        content: {},
      });
    } else if (tool === "circle" && names.length === 2) {
      nextParts.push({
        id: newComponentId("circ"), kind: "circle", nodes: [names[0], names[1]],
        appearance: { color: "#3b82f6", thickness: 1.5, dash: "solid" },
        behaviour: { visible: true, locked: false },
        content: {},
      });
    } else if (tool === "arc" && names.length === 3) {
      nextParts.push({
        id: newComponentId("arc"), kind: "arc", nodes: [names[0], names[1], names[2]],
        appearance: { color: "#3b82f6", thickness: 1.5, dash: "solid" },
        behaviour: { visible: true, locked: false },
        content: {},
      });
    }
    onChange({ nodes: nextNodes, parts: nextParts });
    setPickMode(null);
  };

  // Presentation Mode: hide orange chrome after 5s idle unless the panel
  // is open or the user is actively hovering / editing.
  const [presenting, setPresenting] = useState(true);
  const idleTimer = useState<{ t: ReturnType<typeof setTimeout> | null }>({ t: null })[0];
  const bumpActivity = () => {
    setPresenting(false);
    if (idleTimer.t) clearTimeout(idleTimer.t);
    idleTimer.t = setTimeout(() => setPresenting(true), 10000);
  };
  useEffect(() => {
    if (editorOpen || selected) { setPresenting(false); if (idleTimer.t) clearTimeout(idleTimer.t); return; }
    bumpActivity();
    return () => { if (idleTimer.t) clearTimeout(idleTimer.t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorOpen, selected]);

  // Universal Line Engine — driven by the shared ⚙ Edit chip.
  if (family === "lineEngine") {
    return (
      <SelectionFrame
        selected={selected || editorOpen}
          onEdit={toggleEditor}
        presenting={presenting && !editorOpen && !selected}
        onActivity={bumpActivity}
      >
        <LineEngineNode
          variant={variant}
          attrs={attrs}
          selected={selected}
          editorOpen={editorOpen}
          onCloseEditor={() => setEditorOpen(false)}
          onChange={onChange}
          onDeleteDiagram={onDeleteDiagram}
        />
      </SelectionFrame>
    );
  }

  // Universal Circle Engine — same shell, own model.
  if (family === "circleEngine") {
    return (
      <SelectionFrame
        selected={selected || editorOpen}
          onEdit={toggleEditor}
        presenting={presenting && !editorOpen && !selected}
        onActivity={bumpActivity}
      >
        <CircleEngineNode
          variant={variant}
          attrs={attrs}
          selected={selected}
          editorOpen={editorOpen}
          onCloseEditor={() => setEditorOpen(false)}
          onChange={onChange}
          onDeleteDiagram={onDeleteDiagram}
        />
      </SelectionFrame>
    );
  }

  // Universal 3D Solid Engine — same shell, own model.
  if (family === "solidEngine") {
    return (
      <SelectionFrame
        selected={selected || editorOpen}
          onEdit={toggleEditor}
        presenting={presenting && !editorOpen && !selected}
        onActivity={bumpActivity}
      >
        <SolidEngineNode
          variant={variant}
          attrs={attrs}
          selected={selected}
          editorOpen={editorOpen}
          onCloseEditor={() => setEditorOpen(false)}
          onChange={onChange}
          onDeleteDiagram={onDeleteDiagram}
        />
      </SelectionFrame>
    );
  }

  // Universal Venn Engine — same shell, own model.
  if (family === "vennEngine") {
    return (
      <SelectionFrame
        selected={selected || editorOpen}
          onEdit={toggleEditor}
        presenting={presenting && !editorOpen && !selected}
        onActivity={bumpActivity}
      >
        <VennEngineNode
          variant={variant}
          attrs={attrs}
          selected={selected}
          editorOpen={editorOpen}
          onCloseEditor={() => setEditorOpen(false)}
          onChange={onChange}
          onDeleteDiagram={onDeleteDiagram}
        />
      </SelectionFrame>
    );
  }

  // Universal Tree Engine.
  if (family === "treeEngine") {
    return (
      <SelectionFrame
        selected={selected || editorOpen}
          onEdit={toggleEditor}
        presenting={presenting && !editorOpen && !selected}
        onActivity={bumpActivity}
      >
        <TreeEngineNode
          variant={variant} attrs={attrs} selected={selected}
          editorOpen={editorOpen} onCloseEditor={() => setEditorOpen(false)}
          onChange={onChange} onDeleteDiagram={onDeleteDiagram}
        />
      </SelectionFrame>
    );
  }

  // Universal Flowchart Engine.
  if (family === "flowchartEngine") {
    return (
      <SelectionFrame
        selected={selected || editorOpen}
          onEdit={toggleEditor}
        presenting={presenting && !editorOpen && !selected}
        onActivity={bumpActivity}
      >
        <FlowchartEngineNode
          variant={variant} attrs={attrs} selected={selected}
          editorOpen={editorOpen} onCloseEditor={() => setEditorOpen(false)}
          onChange={onChange} onDeleteDiagram={onDeleteDiagram}
        />
      </SelectionFrame>
    );
  }

  // Universal Logic & Organisation Engine.
  if (family === "orgEngine") {
    return (
      <SelectionFrame
        selected={selected || editorOpen}
          onEdit={toggleEditor}
        presenting={presenting && !editorOpen && !selected}
        onActivity={bumpActivity}
      >
        <OrgEngineNode
          variant={variant} attrs={attrs} selected={selected}
          editorOpen={editorOpen} onCloseEditor={() => setEditorOpen(false)}
          onChange={onChange} onDeleteDiagram={onDeleteDiagram}
        />
      </SelectionFrame>
    );
  }


  // Bypass the geometry PropertyPanel; each widget owns its inline controls.
  // Selection into the right-hand editor is opened via the hover ⚙ Edit chip
  // and stays open until the user closes the panel — independent of tiptap
  // selection.
  const editSelected = selected || editorOpen;

  // SmartChart is special: it behaves as full-width graph paper and its
  // Properties panel opens ONLY when the user clicks ⚙ Edit (not on
  // tiptap selection).
  if (family === "smartChart") {
    return (
      <SelectionFrame
        block
        selected={editSelected}
        onEdit={toggleEditor}
        presenting={presenting && !editorOpen && !selected}
        onActivity={bumpActivity}
      >
        <SmartChart attrs={attrs} onChange={onChange} selected={editorOpen} assetId={assetId} />
      </SelectionFrame>
    );
  }

  const arithmeticNode = (() => {
    switch (family) {
      case "smarttable":       return <SmartTable attrs={attrs} onChange={onChange} selected={editSelected} />;
      case "placeValueChart":  return <PlaceValueChart attrs={attrs} onChange={onChange} selected={editSelected} />;
      case "longDivision":     return <LongDivision attrs={attrs} onChange={onChange} selected={editSelected} />;
      case "divisionLadder":   return <DivisionLadder attrs={attrs} onChange={onChange} selected={editSelected} />;
      case "baseConversion":   return <BaseConversion attrs={attrs} onChange={onChange} selected={editSelected} />;
      case "fractionWall":     return <FractionWall attrs={attrs} onChange={onChange} selected={editSelected} />;
      case "fractionStrip":    return <FractionStrip attrs={attrs} onChange={onChange} selected={editSelected} />;
      case "base10Blocks":     return <Base10Blocks attrs={attrs} onChange={onChange} selected={editSelected} />;
      case "abacusManipulative": return <AbacusAsset attrs={attrs} onChange={onChange} selected={editSelected} />;
      case "coordPlane":       return <CoordinatePlane attrs={attrs} onChange={onChange} selected={editSelected} />;

      default: return null;
    }
  })();
  if (arithmeticNode) {
    return (
      <SelectionFrame
        selected={editSelected}
        onEdit={toggleEditor}
        presenting={presenting && !editorOpen && !selected}
        onActivity={bumpActivity}
      >
        {arithmeticNode}
      </SelectionFrame>
    );
  }



  return (
    <SelectionFrame
      selected={selected || editorOpen}
      onEdit={openEditor}
      presenting={presenting && !editorOpen && !selected}
      onActivity={bumpActivity}
    >
      {geoAdapter && nodes ? (
        <LivingCanvas
          adapter={geoAdapter}
          nodes={nodes}
          labels={labels}
          selected={selected || editorOpen}
          nodeLabels={nodeLabels}
          visibility={visibility}
          viewScale={viewScale}
          components={addOnComponents}
          parts={parts}
          selectedComponentId={editorOpen ? selectedComponentId : null}
          onSelectComponent={setSelectedComponentId}
          onNodesChange={(n) => onChange({ nodes: n })}
          onLabelsChange={(l) => onChange({ labels: l })}
          pickMode={pickMode}
          onPickCommit={commitPick}
          onPickCancel={() => setPickMode(null)}
        />
      ) : (
        <span
          className="block leading-none"
          style={{
            transform: viewScale !== 1 ? `scale(${viewScale})` : undefined,
            transformOrigin: "top left",
            display: "inline-block",
          }}
        >
          {renderVisual(family, attrs, {})}
        </span>
      )}

      <PropertyPanel
        open={editorOpen}
        onClose={closeEditor}
        adapter={geoAdapter}
        attrsAdapter={attrsAdapter}
        attrs={attrs}
        nodes={nodes}
        nodeLabels={nodeLabels}
        visibility={visibility}
        viewScale={viewScale}
        addOnComponents={addOnComponents}
        components={parts}
        selectedComponentId={selectedComponentId}
        onSelectComponent={setSelectedComponentId}
        onPatchAttrs={(patch) => onChange(patch)}
        onPatchComponents={(next) => onChange({ parts: next })}
        pickMode={pickMode}
        onRequestPick={setPickMode}
        onDeleteDiagram={onDeleteDiagram}
      />
    </SelectionFrame>
  );
}

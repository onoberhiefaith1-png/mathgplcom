// Lesson Mode: Angles & Geometry — pick two edges (or two faces, or an
// edge and a face) to display the angle between them.

import { useEffect, useState } from "react";
import { Triangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { topologyFor } from "@/lib/geometry3d/topology";
import { edgeEdgeAngle, faceFaceAngle, edgeFaceAngle } from "@/lib/geometry3d/measure";
import { newId, type Annotation3D, type Scene3D, type Solid3D } from "@/lib/geometry3d/scene3d";

type Mode = "edgeEdge" | "faceFace" | "edgeFace";
type ElementKind = "face" | "edge" | "vertex";

interface Props {
  solid: Solid3D | null;
  scene: Scene3D;
  setScene: (u: (prev: Scene3D) => Scene3D) => void;
  pick: { solidId: string; kind: ElementKind; index: number } | null;
  clearPick: () => void;
  pickKind: ElementKind;
  setPickKind: (k: ElementKind) => void;
}

export function AnglesTools({ solid, scene, setScene, pick, clearPick, pickKind, setPickKind }: Props) {
  const [mode, setMode] = useState<Mode>("edgeEdge");
  const [buffer, setBuffer] = useState<{ kind: "edge" | "face"; index: number }[]>([]);
  const solidId = solid?.id ?? null;

  useEffect(() => {
    if (!pick || !solidId || pick.solidId !== solidId) return;
    const commitAng = (indices: number[], kind: string) => setScene((prev) => ({
      ...prev,
      annotations: [
        ...(prev.annotations ?? []),
        { id: newId("ang"), type: "angle", visible: true, target: { solidId, kind, indices } } as Annotation3D,
      ],
    }));
    setBuffer((prevBuf) => {
      if (mode === "edgeEdge" && pick.kind === "edge") {
        const next = [...prevBuf, { kind: "edge" as const, index: pick.index }];
        if (next.length === 2) { commitAng([next[0].index, next[1].index], "edgePair"); return []; }
        return next;
      }
      if (mode === "faceFace" && pick.kind === "face") {
        const next = [...prevBuf, { kind: "face" as const, index: pick.index }];
        if (next.length === 2) { commitAng([next[0].index, next[1].index], "facePair"); return []; }
        return next;
      }
      if (mode === "edgeFace") {
        const next = [...prevBuf, { kind: pick.kind as "edge" | "face", index: pick.index }];
        const e = next.find((n) => n.kind === "edge");
        const f = next.find((n) => n.kind === "face");
        if (e && f) { commitAng([e.index, f.index], "edgeFace"); setPickKind("edge"); return []; }
        setPickKind(pick.kind === "edge" ? "face" : "edge");
        return next;
      }
      return prevBuf;
    });
    clearPick();
  }, [pick, solidId, mode, clearPick, setScene, setPickKind]);

  if (!solid) {
    return (
      <div className="h-full border-l border-foreground/10 bg-background p-4">
        <p className="text-xs text-muted-foreground">Select a solid, then pick edges or faces to measure an angle.</p>
      </div>
    );
  }

  const chooseMode = (m: Mode) => {
    setMode(m);
    setBuffer([]);
    setPickKind(m === "faceFace" ? "face" : m === "edgeEdge" ? "edge" : "edge");
  };

  const clearAll = () => setScene((prev) => ({
    ...prev,
    annotations: (prev.annotations ?? []).filter((a) => !(a.type === "angle" && a.target.solidId === solid.id)),
  }));

  const btn = (m: Mode, label: string) => (
    <button key={m} onClick={() => chooseMode(m)}
      className={`flex-1 rounded px-2 py-1 text-[11px] ${mode === m ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
    >{label}</button>
  );

  void pickKind;
  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto border-l border-foreground/10 bg-background p-3">
      <div className="flex items-center gap-1.5">
        <Triangle className="h-4 w-4" />
        <p className="text-sm font-semibold">Angles & Geometry</p>
      </div>
      <div className="flex gap-1">{btn("edgeEdge", "Edge / Edge")}{btn("faceFace", "Face / Face")}{btn("edgeFace", "Edge / Face")}</div>
      <p className="text-[11px] text-muted-foreground">
        {mode === "edgeEdge" && "Click two edges — the angle appears at their meeting."}
        {mode === "faceFace" && "Click two faces — the dihedral angle appears."}
        {mode === "edgeFace" && "Click one edge and one face — the line-to-plane angle appears."}
        {buffer.length > 0 && ` · picked ${buffer.length}/2`}
      </p>
      <Button size="sm" variant="ghost" onClick={clearAll} className="gap-1.5">
        <Trash2 className="h-3.5 w-3.5" /> Clear angles
      </Button>
    </div>
  );
}
export default AnglesTools;

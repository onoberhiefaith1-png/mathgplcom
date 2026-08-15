// GeometryModeContext — shared state for the embedded Geometry Mode.
// When `mode === true` the left-side GeometryToolbox is visible and the
// active diagram frame in the lesson note shows its drawing canvas. The
// `tool` is broadcast to every frame; only the selected (active) frame
// actually consumes it. Clicking outside any frame just sets
// `activeFrameId = null` — the toolbox stays until the teacher
// explicitly turns Geometry Mode off.

import { createContext, useContext, useState, type ReactNode } from "react";
import type { ToolId } from "@/lib/geometry/editor/tools";

export interface AnnotationDraft {
  tool: "addText" | "addDistance" | "addAngle" | "addArea"
    | "smartText" | "smartAngle" | "smartArea";
  value: string;
  confirmed: boolean;
  /** Which stage of the temporary workflow the panel should render. */
  step?: "value" | "pick";
  /** Transient feedback shown inside the workflow card. */
  notice?: string;
  /** For addArea only: straight-edge trace or continuous curve trace. */
  traceMode?: "straight" | "curve";
  /** For addAngle & addArea: keep temporary construction points after completion. */
  keepLabels?: boolean;
  /** For addArea only: pre-selected fill colour + opacity. */
  fillColor?: string;
  fillOpacity?: number;
}


interface GeometryModeCtx {
  mode: boolean;
  setMode: (b: boolean) => void;
  tool: ToolId;
  setTool: (t: ToolId) => void;
  activeFrameId: string | null;
  setActiveFrameId: (id: string | null) => void;
  annotationDraft: AnnotationDraft | null;
  setAnnotationDraft: (d: AnnotationDraft | null) => void;
}

const Ctx = createContext<GeometryModeCtx>({
  mode: false,
  setMode: () => {},
  tool: "select",
  setTool: () => {},
  activeFrameId: null,
  setActiveFrameId: () => {},
  annotationDraft: null,
  setAnnotationDraft: () => {},
});

export function GeometryModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState(false);
  const [toolState, setToolState] = useState<ToolId>("select");
  const [activeFrameId, setActiveFrameId] = useState<string | null>(null);
  const [annotationDraft, setAnnotationDraft] = useState<AnnotationDraft | null>(null);

  // When switching tools, seed / clear the annotation draft.
  const setTool = (t: ToolId) => {
    setToolState(t);
    if (t === "addText" || t === "addDistance") {
      setAnnotationDraft({ tool: t, value: "", confirmed: false });
    } else if (t === "addAngle") {
      setAnnotationDraft({ tool: t, value: "", confirmed: false, keepLabels: true });
    } else if (t === "smartText") {
      // Value first ("47 cm", "ASB"), then select the line it attaches to.
      setAnnotationDraft({ tool: t, value: "", confirmed: true, step: "value" });
    } else if (t === "smartAngle") {
      // Value first, then select ONE line at the intersection.
      setAnnotationDraft({ tool: t, value: "", confirmed: true, step: "value", keepLabels: true });
    } else if (t === "smartArea") {
      setAnnotationDraft({
        tool: "smartArea", value: "", confirmed: true, step: "pick",
        traceMode: "straight", keepLabels: true,
        fillColor: "#3b82f6", fillOpacity: 0.25,
      });

    } else if (t === "addArea") {
      setAnnotationDraft({
        tool: "addArea", value: "", confirmed: true,
        traceMode: "straight", keepLabels: true,
        fillColor: "#3b82f6", fillOpacity: 0.25,
      });
    } else {
      setAnnotationDraft(null);
    }
  };

  return (
    <Ctx.Provider value={{ mode, setMode, tool: toolState, setTool, activeFrameId, setActiveFrameId, annotationDraft, setAnnotationDraft }}>
      {children}
    </Ctx.Provider>
  );
}

export function useGeometryMode() {
  return useContext(Ctx);
}

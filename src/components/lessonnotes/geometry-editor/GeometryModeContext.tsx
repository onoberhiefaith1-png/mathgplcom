// GeometryModeContext — shared state for the embedded Geometry Mode.
// When `mode === true` the left-side GeometryToolbox is visible and the
// active diagram frame in the lesson note shows its drawing canvas. The
// `tool` is broadcast to every frame; only the selected (active) frame
// actually consumes it. Clicking outside any frame just sets
// `activeFrameId = null` — the toolbox stays until the teacher
// explicitly turns Geometry Mode off.

import { createContext, useContext, useState, type ReactNode } from "react";
import type { ToolId } from "@/lib/geometry/editor/tools";

interface GeometryModeCtx {
  mode: boolean;
  setMode: (b: boolean) => void;
  tool: ToolId;
  setTool: (t: ToolId) => void;
  activeFrameId: string | null;
  setActiveFrameId: (id: string | null) => void;
}

const Ctx = createContext<GeometryModeCtx>({
  mode: false,
  setMode: () => {},
  tool: "select",
  setTool: () => {},
  activeFrameId: null,
  setActiveFrameId: () => {},
});

export function GeometryModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState(false);
  const [tool, setTool] = useState<ToolId>("select");
  const [activeFrameId, setActiveFrameId] = useState<string | null>(null);
  return (
    <Ctx.Provider value={{ mode, setMode, tool, setTool, activeFrameId, setActiveFrameId }}>
      {children}
    </Ctx.Provider>
  );
}

export function useGeometryMode() {
  return useContext(Ctx);
}

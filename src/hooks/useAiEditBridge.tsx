// AI Edit bridge — lets any asset rendered inside the Lesson Note editor
// (Smart Table cells today, other assets later) open the SAME AI Edit panel
// the selection toolbar uses, and receive the applied text back through its
// own callback instead of a document range replacement.

import { createContext, useContext, type ReactNode } from "react";
import type { SelectionKind } from "@/lib/lessonnotes/detectSelectionKind";

export interface AiEditRequest {
  /** The exact text handed to AI Edit (a cell, or part of a cell). */
  text: string;
  kind?: SelectionKind;
  /** Human label shown in the panel header context (optional). */
  label?: string;
  /** Called with the proposed text when the teacher clicks Apply. */
  onApply: (proposed: string) => void;
}

interface Ctx {
  requestAiEdit: (req: AiEditRequest) => void;
}

const AiEditBridgeContext = createContext<Ctx | null>(null);

export function AiEditBridgeProvider({
  requestAiEdit,
  children,
}: {
  requestAiEdit: (req: AiEditRequest) => void;
  children: ReactNode;
}) {
  return (
    <AiEditBridgeContext.Provider value={{ requestAiEdit }}>
      {children}
    </AiEditBridgeContext.Provider>
  );
}

/** Null when the consumer is rendered outside the Lesson Note editor. */
export function useAiEditBridge(): Ctx | null {
  return useContext(AiEditBridgeContext);
}

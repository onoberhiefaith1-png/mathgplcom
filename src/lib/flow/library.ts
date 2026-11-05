// A lesson note stores a flow id, not a copy of the flow.
// A MathGPL library flow may point at the administrator's working flow.
// Readers see whichever copy was edited more recently, so a save on either
// side reaches everyone using the library id. A personal copy is a fork.

export type FlowLibraryRecord = {
  id: string;
  scope: "mathgpl" | "personal";
  sourceFlowId: string | null;
  name: string;
  clips: unknown[];
  scenes: unknown[];
  cover_path: string | null;
  cover_type: "image" | "video" | null;
  position: Record<string, unknown>;
  updatedAt: string;
};

/** True when this row was made with Copy to My Flows and must stay frozen. */
export const isPrivateFlowFork = (flow: { scope: string; sourceFlowId?: string | null }): boolean =>
  flow.scope === "personal" && !!flow.sourceFlowId;

/**
 * Content a lesson note should play for a library flow.
 * The library id stays stable. Newer source content replaces the library row.
 */
export const libraryFlowContent = <T extends FlowLibraryRecord>(library: T, source: T | null): T => {
  if (library.scope !== "mathgpl" || !library.sourceFlowId || !source) return library;
  if (source.id === library.id) return library;
  if (!source.updatedAt || source.updatedAt <= library.updatedAt) return library;
  return {
    ...library,
    name: source.name,
    clips: source.clips,
    scenes: source.scenes,
    cover_path: source.cover_path,
    cover_type: source.cover_type,
    position: source.position,
    updatedAt: source.updatedAt,
  };
};

/** Open the Assign dialog from a decoration button or a forced-Assign click. */
import type { AssignmentEndpoint } from "./assignmentEndpoints";

export type AssignRequest = {
  endpoint: AssignmentEndpoint;
  source: "detected" | "forced-mcq" | "forced-floating";
};

type Listener = (request: AssignRequest) => void;
const listeners = new Set<Listener>();

export function subscribeAssignRequest(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function requestAssign(request: AssignRequest): void {
  for (const listener of listeners) listener(request);
}

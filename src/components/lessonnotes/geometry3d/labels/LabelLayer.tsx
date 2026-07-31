// LabelLayer — provides the shared label store and runs collision avoidance.
// Must be mounted inside the Canvas, wrapping every Label3D.

import { useMemo } from "react";
import { LabelLayoutContext, useLabelLayoutRunner, type LabelStore } from "./useLabelLayout";

function Runner({ store }: { store: LabelStore }) {
  useLabelLayoutRunner(store);
  return null;
}

export function LabelLayer({ children }: { children: React.ReactNode }) {
  const store = useMemo<LabelStore>(() => ({ entries: new Map() }), []);
  return (
    <LabelLayoutContext.Provider value={store}>
      <Runner store={store} />
      {children}
    </LabelLayoutContext.Provider>
  );
}

export default LabelLayer;

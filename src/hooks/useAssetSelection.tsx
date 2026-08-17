// Global selection + editor slot for the universal right-hand Properties
// Panel. Any asset (Smart Table, arithmetic assets, engines, geometry, …)
// calls `useRegisterAssetEditor` while it is the active selection, and the
// panel renders whatever editor node it registered. This gives the whole
// application ONE editing surface.
//
// The registration lives in an external store rather than React state on a
// provider: assets hand over a fresh `editor` JSX node on every render, and
// storing that in provider state re-rendered the whole subtree (including the
// asset), which re-created the editor node and looped forever
// ("Maximum update depth exceeded"). With an external store only the panel
// re-renders when the editor changes, so there is no feedback loop.

import { useContext, useEffect, useSyncExternalStore, createContext, type ReactNode } from "react";

interface Registration {
  id: string;
  title: string;
  editor: ReactNode;
  /** Changes whenever the asset's *inner* selection changes (e.g. which
   *  line / label / angle of a diagram is picked). The panel uses it to
   *  surface itself again for a newly picked item. */
  token?: string;
}


let current: Registration | null = null;
const listeners = new Set<() => void>();

const emit = () => { listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const getSnapshot = () => current;
const getServerSnapshot = () => null;

function publish(next: Registration | null) {
  if (current === next) return;
  current = next;
  emit();
}

// Kept for API compatibility — the store is module-level, so the provider is
// just a passthrough marker that tells assets a panel exists.
const AssetSelectionContext = createContext<boolean>(false);

export function AssetSelectionProvider({ children }: { children: ReactNode }) {
  return (
    <AssetSelectionContext.Provider value={true}>{children}</AssetSelectionContext.Provider>
  );
}

/** Panel-side: the currently registered editor, or null. */
export function useAssetSelection() {
  const reg = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { reg };
}

/**
 * Called from inside an asset. While `active` is true, the asset owns the
 * right-hand panel and renders `editor` there. When it goes inactive (or
 * unmounts), it clears its slot.
 */
export function useRegisterAssetEditor(
  active: boolean,
  id: string,
  title: string,
  editor: ReactNode,
  token?: string,
) {
  const enabled = useContext(AssetSelectionContext);

  // Push the latest editor while active. No cleanup here: clearing on every
  // editor change would blank the panel between renders.
  useEffect(() => {
    if (!enabled || !active) return;
    publish({ id, title, editor, token });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, active, id, title, editor, token]);


  // Release the slot when this asset stops being active, or unmounts.
  useEffect(() => {
    if (!enabled || !active) return;
    return () => {
      if (current && current.id === id) publish(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, active, id]);
}

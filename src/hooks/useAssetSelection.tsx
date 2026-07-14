// Global selection + editor slot for the universal right-hand Properties
// Panel. Any asset (Smart Table, arithmetic assets, engines, geometry, …)
// calls `useRegisterAssetEditor` while it is the active selection, and the
// panel renders whatever editor node it registered. This gives the whole
// application ONE editing surface.

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface Registration {
  id: string;
  title: string;
  editor: ReactNode;
}

interface Ctx {
  reg: Registration | null;
  setReg: React.Dispatch<React.SetStateAction<Registration | null>>;
}

const AssetSelectionContext = createContext<Ctx | null>(null);

export function AssetSelectionProvider({ children }: { children: ReactNode }) {
  const [reg, setReg] = useState<Registration | null>(null);
  return (
    <AssetSelectionContext.Provider value={{ reg, setReg }}>
      {children}
    </AssetSelectionContext.Provider>
  );
}

export function useAssetSelection() {
  return useContext(AssetSelectionContext);
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
) {
  const ctx = useContext(AssetSelectionContext);
  useEffect(() => {
    if (!ctx || !active) return;
    // Functional update: only replace when something meaningful changed.
    // Prevents an infinite render loop when callers pass a fresh JSX
    // `editor` each render — we still push the latest editor, but only
    // trigger a state update if it's actually different.
    ctx.setReg((prev) => {
      if (prev && prev.id === id && prev.title === title && prev.editor === editor) return prev;
      return { id, title, editor };
    });
    return () => {
      ctx.setReg((prev) => (prev && prev.id === id ? null : prev));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, id, title, editor]);
}

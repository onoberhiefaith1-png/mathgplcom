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
    if (!ctx) return;
    if (active) {
      ctx.setReg({ id, title, editor });
      return () => {
        // Only clear if we're still the active one.
        ctx.setReg((prev: any) => (prev && prev.id === id ? null : prev) as any);
      };
    }
    return;
    // Editor node changes each render — we want to push the latest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, id, title, editor]);
}

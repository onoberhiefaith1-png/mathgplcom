// Universal right-hand Properties Panel. Renders the editor registered by
// the currently-selected asset via `useAssetSelection` / `useRegisterAssetEditor`.

import { useAssetSelection } from "@/hooks/useAssetSelection";
import { Settings2 } from "lucide-react";

export function PropertiesPanel() {
  const ctx = useAssetSelection();
  const reg = ctx?.reg ?? null;

  return (
    <aside
      className="hidden lg:flex flex-col shrink-0 border-l border-foreground/10 bg-background text-foreground"
      style={{ width: 300 }}
      aria-label="Asset properties panel"
    >
      <div className="h-9 px-3 flex items-center gap-2 border-b border-foreground/10 text-xs font-semibold uppercase tracking-wider text-foreground/70">
        <Settings2 className="h-3.5 w-3.5" />
        {reg ? reg.title : "Properties"}
      </div>
      <div className="flex-1 overflow-auto p-3 text-sm text-foreground">
        {reg ? reg.editor : (
          <div className="text-foreground/50 text-xs leading-relaxed">
            Select an asset in the document to edit its properties here.
          </div>
        )}
      </div>
    </aside>
  );
}

export default PropertiesPanel;

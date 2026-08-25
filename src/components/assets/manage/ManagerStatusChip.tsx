import { Eye, Pencil } from "lucide-react";
import { useAssetManager } from "@/lib/gpl/useAssetManager";

/**
 * Says out loud whether the current account can author the official library, so
 * missing buttons are never a mystery.
 */
const ManagerStatusChip = ({ className = "" }: { className?: string }) => {
  const { isManager, checked } = useAssetManager();
  if (!checked) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] backdrop-blur ${
        isManager
          ? "border-primary/50 bg-primary/10 text-primary"
          : "border-border/50 bg-background/60 text-muted-foreground"
      } ${className}`}
    >
      {isManager ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      {isManager ? "Managing library" : "Read-only"}
    </span>
  );
};

export default ManagerStatusChip;

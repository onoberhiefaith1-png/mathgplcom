import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { flowUrl } from "@/lib/flow/api";
import type { FlowConfig } from "@/lib/flow/types";

export const FlowCard = ({ flow, selected, onClick, badge }: { flow: FlowConfig; selected?: boolean; onClick: () => void; badge?: string }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { if (flow.cover_path) flowUrl(flow.cover_path).then(setUrl); }, [flow.cover_path]);
  return (
    <button type="button" onClick={onClick} className={`group w-40 text-left ${selected ? "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-lg" : ""}`}>
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-muted">
        {url ? (flow.cover_type === "video"
          ? <video src={url} muted autoPlay loop playsInline className="h-full w-full object-cover" />
          : <img src={url} alt={flow.name} className="h-full w-full object-cover transition group-hover:scale-105" />)
          : <div className="grid h-full place-items-center"><Sparkles className="h-8 w-8 text-muted-foreground" /></div>}
        {badge && <span className="absolute left-1.5 top-1.5 rounded bg-background/80 px-1.5 py-0.5 text-[10px]">{badge}</span>}
      </div>
      <div className="mt-1.5 truncate text-center text-sm font-medium">{flow.name}</div>
    </button>
  );
};

export default FlowCard;

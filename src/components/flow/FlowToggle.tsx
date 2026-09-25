import { useEffect, useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { loadNotebookFlow, setNotebookFlow } from "@/lib/flow/api";
import { validateScenes } from "@/lib/flow/segments";
import type { FlowConfig } from "@/lib/flow/types";
import { toast } from "@/hooks/use-toast";

export const FlowToggle = ({ notebookId }: { notebookId: string }) => {
  const navigate = useNavigate();
  const [cfg, setCfg] = useState<FlowConfig | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { loadNotebookFlow(notebookId).then((c) => { setCfg(c); setLoaded(true); }); }, [notebookId]);

  const toggle = async (on: boolean) => {
    const fresh = await loadNotebookFlow(notebookId);
    if (!fresh) { navigate(`/lesson-notes/${notebookId}/flow`); return; }
    if (on) {
      const errs = fresh.clips.length ? validateScenes(fresh.scenes) : ["Upload a character video first."];
      if (errs.length) { toast({ title: "Flow setup incomplete", description: errs[0] }); return; }
    }
    try { await setNotebookFlow(notebookId, { flow_enabled: on }); setCfg({ ...fresh, enabled: on }); }
    catch (e) { toast({ title: "Could not save", description: (e as Error).message, variant: "destructive" }); }
  };

  return (
    <div className="flex items-center gap-2 rounded-md border border-foreground/10 px-2 py-1">
      <button
        onClick={() => navigate(`/lesson-notes/${notebookId}/flow`)}
        className="flex items-center gap-1 text-xs font-medium text-foreground/80 hover:text-foreground"
      >
        <Sparkles className="h-3.5 w-3.5" /> {cfg ? cfg.name : "Select Flow"}
      </button>
      <Switch checked={!!cfg?.enabled} onCheckedChange={toggle} disabled={!loaded || !cfg} aria-label="Flow on or off" />
      <span className="w-6 text-[10px] text-foreground/60">{cfg?.enabled ? "ON" : "OFF"}</span>
    </div>
  );
};

export default FlowToggle;

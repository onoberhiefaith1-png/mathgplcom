// Flow page (user's own flows) and the MyGPL Flow library (admin flows).
// ?lib=mathgpl switches to the library. With :id (a lesson note) both views
// double as the lesson's "Select Flow" screen.
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "@/lib/router-compat";
import { ArrowLeft, Check, Copy, ImageIcon, Loader2, MoreVertical, Pencil, Plus, Send, Sparkles, Trash2, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { copyFlow, createFlow, deleteFlow, flowUrl, getNotebookFlowRef, isAdmin, listFlows, sendToLibrary, setNotebookFlow, uploadFlowBlob } from "@/lib/flow/api";
import { validateScenes } from "@/lib/flow/segments";
import type { FlowConfig, FlowScope } from "@/lib/flow/types";
import { flowLibraryBg } from "@/lib/flow/flow.functions";
import FlowCard from "@/components/flow/FlowCard";

const settings = () => supabase.from("flow_library_settings" as never) as any;

const FlowLibraryPage = () => {
  const { id: noteId } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const inLibrary = search.get("lib") === "mathgpl";
  const [flows, setFlows] = useState<FlowConfig[]>([]);
  const [uid, setUid] = useState<string | null>(null);
  const [admin, setAdmin] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [bg, setBg] = useState<{ url: string; type: string } | null>(null);
  const [bgBusy, setBgBusy] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);

  const loadBg = async () => {
    const { data } = await settings().select("background_path, background_type").eq("id", 1).maybeSingle();
    if (data?.background_path) {
      const url = await flowUrl(data.background_path);
      setBg(url ? { url, type: data.background_type ?? "image" } : null);
    } else setBg(null);
  };

  const load = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) { navigate(`/auth?redirect=${encodeURIComponent(location.pathname + location.search)}`); return; }
    setUid(data.user.id);
    const [list, a] = await Promise.all([listFlows(), isAdmin()]);
    setFlows(list); setAdmin(a);
    if (noteId) { const r = await getNotebookFlowRef(noteId); setSelected(r.flowId); setEnabled(r.enabled); }
    loadBg();
  };
  useEffect(() => { load(); }, [noteId]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveBg = async (background_path: string | null, background_type: string | null) => {
    const { error } = await settings().update({ background_path, background_type }).eq("id", 1);
    if (error) throw error;
    await loadBg();
  };
  const uploadBg = async (f: File | undefined, type: "image" | "video") => {
    if (!f) return;
    setBgBusy(true);
    try { await saveBg(await uploadFlowBlob("library", f, f.name.split(".").pop() || (type === "video" ? "mp4" : "png")), type); }
    catch (e) { toast({ title: "Background upload failed", description: (e as Error).message, variant: "destructive" }); }
    finally { setBgBusy(false); }
  };
  const aiBg = async () => {
    const prompt = window.prompt("Describe the background (optional)", "") ?? null;
    if (prompt === null) return;
    setBgBusy(true);
    try {
      await flowLibraryBg({ data: { prompt } });
      await loadBg();
    } catch (e) { toast({ title: "Could not generate background", description: (e as Error).message, variant: "destructive" }); }
    finally { setBgBusy(false); }
  };

  const mathgpl = flows.filter((f) => f.scope === "mathgpl");
  const mine = flows.filter((f) => f.scope === "personal" && f.owner_id === uid);
  const goLibrary = (on: boolean) => { const s = new URLSearchParams(search); on ? s.set("lib", "mathgpl") : s.delete("lib"); setSearch(s); };
  const open = (f: FlowConfig) => navigate(`/flows/${f.id}${noteId ? `?note=${noteId}` : ""}`);

  const create = async (scope: FlowScope) => {
    const name = prompt("Name your Flow", scope === "mathgpl" ? "New MathGPL Flow" : "My Flow");
    if (!name) return;
    try { open(await createFlow(name.trim() || "Untitled Flow", scope)); }
    catch (e) { toast({ title: "Could not create", description: (e as Error).message, variant: "destructive" }); }
  };

  const remove = async (f: FlowConfig) => {
    if (!confirm(`Delete "${f.name}"? Lesson notes using it will have no Flow.`)) return;
    try { await deleteFlow(f.id); load(); }
    catch (e) { toast({ title: "Could not delete", description: (e as Error).message, variant: "destructive" }); }
  };

  const choose = async (f: FlowConfig) => {
    if (!noteId) return open(f);
    try {
      const ready = f.clips.length > 0 && validateScenes(f.scenes).length === 0;
      const on = enabled && ready;
      await setNotebookFlow(noteId, { flow_id: f.id, flow_enabled: on });
      setSelected(f.id); setEnabled(on);
      toast({ title: `${f.name} selected`, description: ready ? "Switch Flow ON to show it on the Smartboard." : "This Flow isn't fully set up yet." });
    } catch (e) { toast({ title: "Could not select", description: (e as Error).message, variant: "destructive" }); }
  };

  const toggleOn = async (on: boolean) => {
    if (!noteId || !selected) return;
    const f = flows.find((x) => x.id === selected);
    if (on && f && (!f.clips.length || validateScenes(f.scenes).length)) {
      toast({ title: "Flow setup incomplete", description: validateScenes(f.scenes)[0] ?? "Upload a character video first." });
      return;
    }
    await setNotebookFlow(noteId, { flow_enabled: on }); setEnabled(on);
  };

  const canManage = (f: FlowConfig) => (f.scope === "mathgpl" ? admin : f.owner_id === uid);

  const copy = async (f: FlowConfig) => {
    try { const c = await copyFlow(f.id); setFlows((l) => [...l, c]); toast({ title: `${f.name} copied to My Flows`, description: "Your copy is private. Changes won't affect the original." }); }
    catch (e) { toast({ title: "Could not copy", description: (e as Error).message, variant: "destructive" }); }
  };
  const send = async (f: FlowConfig) => {
    try { const r = await sendToLibrary(f.id); toast({ title: r === "updated" ? "MathGPL Flow updated" : "Sent to MathGPL Flow", description: `${f.name} is now available to everyone.` }); load(); }
    catch (e) { toast({ title: "Could not send", description: (e as Error).message, variant: "destructive" }); }
  };

  const Cards = ({ items, scope }: { items: FlowConfig[]; scope: FlowScope }) => (
    <div className="flex flex-wrap justify-center gap-6">
      {items.map((f) => (
        <div key={f.id} className="relative">
          <FlowCard flow={f} selected={selected === f.id} onClick={() => choose(f)} />
          {selected === f.id && <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="h-3.5 w-3.5" /></span>}
          <div className="mt-1 flex flex-wrap justify-center gap-1">
            {(noteId || scope === "mathgpl") && <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => open(f)}><Pencil className="mr-1 h-3 w-3" />{canManage(f) ? "Edit" : "Preview"}</Button>}
            {scope === "mathgpl" && <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => copy(f)}><Copy className="mr-1 h-3 w-3" />Copy to My Flows</Button>}
            {scope === "personal" && admin && <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => send(f)}><Send className="mr-1 h-3 w-3" />Send to MathGPL Flow</Button>}
            {canManage(f) && <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => remove(f)} aria-label={scope === "mathgpl" ? "Remove from MathGPL Flow" : "Delete Flow"}><Trash2 className="h-3 w-3" /></Button>}
          </div>
        </div>
      ))}
      {scope === "personal" && (
        <button onClick={() => create(scope)} className="grid aspect-[4/3] w-40 place-items-center rounded-lg border border-dashed border-border bg-background/40 text-sm text-muted-foreground hover:text-foreground">
          <span className="flex items-center gap-1"><Plus className="h-4 w-4" /> Create Flow</span>
        </button>
      )}
      {!items.length && scope === "mathgpl" && <p className="text-sm text-muted-foreground">No MathGPL Flows yet.</p>}
    </div>
  );

  const LessonBar = () => (
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="sm" onClick={() => navigate(noteId ? `/lesson-notes/${noteId}` : "/lesson-notes")} className="gap-1.5">
        <ArrowLeft className="h-3.5 w-3.5" /> {noteId ? "Lesson note" : "Shelf"}
      </Button>
      <div className="flex-1" />
      {noteId && (
        <label className="flex items-center gap-2 text-xs">
          Flow {enabled ? "ON" : "OFF"}
          <Switch checked={enabled} disabled={!selected} onCheckedChange={toggleOn} aria-label="Flow on or off" />
        </label>
      )}
    </div>
  );

  if (!inLibrary) {
    return (
      <main className="min-h-screen bg-background p-4 text-foreground">
        <LessonBar />
        <div className="mx-auto max-w-5xl space-y-10 py-10">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-[0.3em]">FLOW</h1>
            <Button variant="outline" onClick={() => goLibrary(true)} className="gap-1.5"><Sparkles className="h-4 w-4" /> MathGPL Flow</Button>
          </div>
          <Cards items={mine} scope="personal" />
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {bg && (bg.type === "video"
        ? <video src={bg.url} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover" />
        : <img src={bg.url} alt="" className="absolute inset-0 h-full w-full object-cover" />)}
      {bg && <div className="absolute inset-0 bg-background/40" aria-hidden />}
      <div className="relative p-4">
        <LessonBar />
        <div className="mt-4 flex items-center">
          <button onClick={() => goLibrary(false)} className="text-2xl font-bold tracking-[0.3em] hover:text-primary">FLOW</button>
          <div className="flex-1" />
          {bgBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {admin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Library background"><MoreVertical className="h-5 w-5" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => imgRef.current?.click()}><ImageIcon className="mr-2 h-4 w-4" /> Upload Image</DropdownMenuItem>
                <DropdownMenuItem onClick={() => vidRef.current?.click()}><Video className="mr-2 h-4 w-4" /> Upload Video</DropdownMenuItem>
                <DropdownMenuItem onClick={aiBg}><Sparkles className="mr-2 h-4 w-4" /> AI Generate</DropdownMenuItem>
                <DropdownMenuItem disabled={!bg} onClick={() => saveBg(null, null).catch((e) => toast({ title: "Could not remove", description: e.message, variant: "destructive" }))}><X className="mr-2 h-4 w-4" /> Remove Background</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadBg(e.target.files?.[0], "image")} />
          <input ref={vidRef} type="file" accept="video/*" className="hidden" onChange={(e) => uploadBg(e.target.files?.[0], "video")} />
        </div>
        <div className="mx-auto max-w-5xl py-12">
          <Cards items={mathgpl} scope="mathgpl" />
        </div>
      </div>
    </main>
  );
};

export default FlowLibraryPage;

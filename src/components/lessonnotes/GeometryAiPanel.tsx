// GeometryAiPanel — right-hand AI editor for geometry diagrams. Mirrors
// the Floating Number AI Editor pattern: the diagram in the lesson note
// stays untouched; the panel shows a preview of the proposed edit with
// Apply / Regenerate / Cancel. The teacher communicates in natural
// language, optionally by voice.

import { useEffect, useRef, useState } from "react";
import { Sparkles, Mic, Loader2, X, Send, RefreshCw, Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { GeometryDiagram } from "@/components/lessonnotes/GeometryDiagram";
import { onGeometryAiEdit } from "@/components/lessonnotes/extensions/GeometryDiagram";
import {
  type GeometryScene,
  diffScenes,
  sanitizeScene,
} from "@/lib/geometry/scene";

interface ActiveSession {
  original: GeometryScene;
  topic?: string;
  onApply: (next: GeometryScene) => void;
}

interface Turn {
  instruction: string;
  proposed: GeometryScene | null;
  error?: string;
}

export function GeometryAiPanel() {
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [turn, setTurn] = useState<Turn | null>(null);
  const [listening, setListening] = useState(false);
  const recogRef = useRef<any>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [imageRefs, setImageRefs] = useState<string[]>([]);

  // Listen for "open" requests from the TipTap NodeView.
  useEffect(() => {
    return onGeometryAiEdit((detail) => {
      setSession({ original: detail.scene, topic: detail.topic, onApply: detail.onApply });
      setTurn(null);
      setInput("");
      setImageRefs([]);
    });
  }, []);

  const close = () => {
    stopVoice();
    setSession(null);
    setTurn(null);
    setInput("");
    setImageRefs([]);
  };

  const startVoice = () => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast({ title: "Voice not supported in this browser" }); return; }
    try {
      const r = new SR();
      r.continuous = false; r.interimResults = true; r.lang = "en-US";
      r.onresult = (e: any) => {
        let finalT = "", interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalT += t; else interim += t;
        }
        setInput((p) => (finalT ? (p ? `${p} ${finalT}`.trim() : finalT) : interim || p));
      };
      r.onend = () => setListening(false);
      r.onerror = () => setListening(false);
      recogRef.current = r;
      r.start();
      setListening(true);
    } catch { setListening(false); }
  };
  const stopVoice = () => { try { recogRef.current?.stop(); } catch {} setListening(false); };

  const pickFiles = async (files: FileList | null) => {
    if (!files) return;
    const next: string[] = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue;
      next.push(await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = rej;
        r.readAsDataURL(f);
      }));
    }
    if (next.length) setImageRefs((p) => [...p, ...next]);
  };

  const submit = async (instructionOverride?: string) => {
    if (!session) return;
    const instruction = (instructionOverride ?? input).trim();
    if (!instruction && imageRefs.length === 0) return;
    setBusy(true);
    try {
      const sceneForEdit = turn?.proposed ?? session.original;
      const { data, error } = await supabase.functions.invoke("geometry-edit", {
        body: {
          scene: sceneForEdit,
          instruction,
          topic: session.topic,
          images: imageRefs,
        },
      });
      if (error) throw error;
      const next = sanitizeScene((data as any)?.scene);
      if (!next) throw new Error("AI returned an invalid scene");
      setTurn({ instruction, proposed: next });
      setInput("");
      setImageRefs([]);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      setTurn({ instruction, proposed: null, error: msg });
      toast({ title: "Edit failed", description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!session || !turn?.proposed) return;
    session.onApply(turn.proposed);
    toast({ title: "Diagram updated" });
    close();
  };

  if (!session) return null;

  const previewScene = turn?.proposed ?? session.original;
  const diff = turn?.proposed
    ? diffScenes(session.original, turn.proposed)
    : undefined;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 bottom-0 z-40 w-[min(960px,96vw)] max-h-[55vh] bg-background border-t border-x border-foreground/15 rounded-t-lg shadow-2xl flex flex-col"
      role="dialog"
      aria-label="Geometry AI editor"
    >
      <header className="px-4 py-3 border-b border-foreground/10 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-medium">Geometry AI Editor</h2>
        {session.topic && (
          <span className="text-[10px] uppercase tracking-wider text-foreground/50">
            {session.topic}
          </span>
        )}
        <button
          type="button"
          onClick={close}
          className="ml-auto p-1 rounded hover:bg-foreground/10"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <section>
          <p className="text-[10px] uppercase tracking-wider text-foreground/55 mb-1">
            {turn?.proposed ? "Proposed change" : "Current diagram"}
          </p>
          <div className="rounded border border-foreground/15 p-2 bg-white flex justify-center">
            <GeometryDiagram scene={previewScene} diff={diff} large />
          </div>
          {turn?.proposed && (
            <div className="mt-1 flex items-center gap-3 text-[11px] text-foreground/60">
              {diff && diff.added.size > 0 && (
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> added {diff.added.size}
                </span>
              )}
              {diff && diff.changed.size > 0 && (
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-500" /> changed {diff.changed.size}
                </span>
              )}
              {diff && diff.removed.size > 0 && (
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-red-500" /> removed {diff.removed.size}
                </span>
              )}
            </div>
          )}
        </section>

        {turn?.instruction && (
          <section className="text-xs text-foreground/70">
            <p className="text-[10px] uppercase tracking-wider text-foreground/55 mb-1">
              You said
            </p>
            <p className="italic">"{turn.instruction}"</p>
            {turn.error && (
              <p className="mt-1 text-red-500">Error: {turn.error}</p>
            )}
          </section>
        )}

        {turn?.proposed && !turn.error && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={apply}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded bg-primary text-primary-foreground"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => submit(turn.instruction)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded border border-foreground/20 hover:bg-foreground/5"
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Edit again
            </button>
            <button
              type="button"
              onClick={() => setTurn(null)}
              className="inline-flex items-center text-xs px-3 py-2 rounded hover:bg-foreground/5"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <footer className="p-3 border-t border-foreground/10 space-y-2">
        {imageRefs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {imageRefs.map((src, i) => (
              <div key={i} className="relative h-12 w-12 rounded overflow-hidden border border-foreground/15">
                <img src={src} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImageRefs((p) => p.filter((_, k) => k !== i))}
                  className="absolute -top-1 -right-1 h-4 w-4 inline-flex items-center justify-center rounded-full bg-background border border-foreground/20"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder='e.g. "Change the angle to 45°", "Make triangle ABC isosceles", "Add a tangent at point B"'
            rows={2}
            className="flex-1 resize-none text-sm bg-transparent border border-foreground/20 rounded px-2 py-1.5 outline-hidden focus:border-primary"
          />
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={listening ? stopVoice : startVoice}
              className={cn(
                "p-2 rounded hover:bg-foreground/10",
                listening && "text-red-500 bg-red-500/10 animate-pulse",
              )}
              title={listening ? "Stop voice" : "Speak"}
            >
              <Mic className="h-4 w-4" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => { pickFiles(e.target.files); e.target.value = ""; }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="p-2 rounded hover:bg-foreground/10"
              title="Upload reference image"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => submit()}
              disabled={busy || (!input.trim() && imageRefs.length === 0)}
              className="p-2 rounded bg-primary text-primary-foreground disabled:opacity-50"
              title="Send"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <p className="text-[10px] text-foreground/50 leading-snug">
          Try: "label the vertices A, B, C", "add a midpoint", "remove the construction lines",
          "draw a tangent at point P", "make the angle a right angle".
        </p>
      </footer>
    </div>
  );
}

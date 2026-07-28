// Shared AI popover used by the global ribbon AI button AND each section
// heading's inline AI button. Keeps the UI (text input + mic + Generate)
// identical everywhere. The caller supplies onGenerate(prompt, opts) which
// runs the actual notebook-ai call and inserts content.
//
// Optional features:
//  • allowAttachments — show paperclip + camera buttons. Picked images are
//    forwarded as base64 dataUrls (opts.images) so the caller can route them
//    through the existing notebook-ai `scan` mode.

import { useRef, useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Sparkles, Loader2, Mic, Paperclip, Camera, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export interface AiGenerateOptions {
  images: string[]; // base64 dataUrls, may be empty
}

export interface AiFooterAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  onRun: () => Promise<void> | void;
}

interface Props {
  trigger: React.ReactNode;
  /** Title shown at the top of the popover (e.g. "Generate Example"). */
  title?: string;
  placeholder?: string;
  /** Optional extra control rendered above the input (e.g. scope toggle). */
  topControls?: React.ReactNode;
  /** Returns a promise that resolves when generation+insertion is done. */
  onGenerate: (prompt: string, opts: AiGenerateOptions) => Promise<void>;
  hint?: string;
  /** Show paperclip + camera; pass picked images to onGenerate. */
  allowAttachments?: boolean;
  /** Extra row of contextual actions (e.g. Regenerate / Paraphrase / Clear). */
  footerActions?: AiFooterAction[];
}

const fileToDataUrl = (f: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(f);
  });

export function AiPopover({
  trigger, title, placeholder, topControls, onGenerate, hint, allowAttachments, footerActions,
}: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const recogRef = useRef<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

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
        setText((p) => (finalT ? (p ? `${p} ${finalT}`.trim() : finalT) : interim || p));
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
      try { next.push(await fileToDataUrl(f)); } catch {}
    }
    if (next.length) setImages((p) => [...p, ...next]);
  };

  const fire = async () => {
    setBusy(true);
    try {
      await onGenerate(text.trim(), { images });
      setText("");
      setImages([]);
      setOpen(false);
    } catch (e: any) {
      toast({ title: "AI failed", description: String(e?.message ?? e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) { stopVoice(); setView("prompt"); } }}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-80 p-2 space-y-2">
        {view === "settings" ? (
          <AiSettingsPanel
            value={prefs}
            onChange={(next) => { setPrefs(next); saveAiPreferences(notebookId, next); }}
            onBack={() => setView("prompt")}
          />
        ) : (
        <>
        <div className="flex items-center gap-1">
          {title && (
            <p className="text-[10px] uppercase tracking-wider text-foreground/55 px-0.5">{title}</p>
          )}
          <button
            type="button"
            onClick={() => setView("settings")}
            title="AI settings — tell AI exactly what you want"
            className="ml-auto p-1 rounded text-foreground/55 hover:text-foreground hover:bg-foreground/10 transition"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
        </div>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {chips.map((c) => (
              <span
                key={c}
                className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/10 text-foreground/70 border border-primary/25"
              >
                {c}
              </span>
            ))}
          </div>
        )}
        {topControls}

        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); fire(); } }}
          placeholder={placeholder ?? "What should AI write?"}
          className="w-full text-sm bg-transparent border-b border-foreground/20 outline-none py-1 placeholder:text-foreground/40"
        />
        {allowAttachments && images.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {images.map((src, i) => (
              <div key={i} className="relative h-12 w-12 rounded overflow-hidden border border-foreground/15">
                <img src={src} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImages((p) => p.filter((_, k) => k !== i))}
                  className="absolute -top-1 -right-1 h-4 w-4 inline-flex items-center justify-center rounded-full bg-background border border-foreground/20"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={listening ? stopVoice : startVoice}
            className={cn(
              "p-1.5 rounded hover:bg-foreground/5 transition",
              listening && "text-red-500 animate-pulse bg-red-500/10",
            )}
            title={listening ? "Stop voice" : "Speak"}
          >
            <Mic className="h-4 w-4" />
          </button>
          {allowAttachments && (
            <>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                onChange={(e) => { pickFiles(e.target.files); e.target.value = ""; }} />
              <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => { pickFiles(e.target.files); e.target.value = ""; }} />
              <button type="button" onClick={() => fileRef.current?.click()}
                className="p-1.5 rounded hover:bg-foreground/5 transition" title="Attach an image (textbook, worksheet)">
                <Paperclip className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => camRef.current?.click()}
                className="p-1.5 rounded hover:bg-foreground/5 transition" title="Take a photo">
                <Camera className="h-4 w-4" />
              </button>
            </>
          )}
          <span className="text-[10px] uppercase tracking-wider text-foreground/55">
            {listening ? "listening…" : "type · speak · attach"}
          </span>
          <button
            type="button"
            onClick={fire}
            disabled={busy}
            className="ml-auto inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded bg-foreground/10 hover:bg-foreground/15 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Generate
          </button>
        </div>
        {hint && (
          <p className="text-[10px] text-foreground/50 leading-snug">{hint}</p>
        )}
        {footerActions && footerActions.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1.5 border-t border-foreground/10">
            {footerActions.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={async () => {
                  setBusy(true);
                  try { await a.onRun(); setOpen(false); }
                  catch (e: any) { toast({ title: "AI failed", description: String(e?.message ?? e), variant: "destructive" }); }
                  finally { setBusy(false); }
                }}
                disabled={busy}
                className={cn(
                  "inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-1 rounded hover:bg-foreground/10 transition",
                  a.danger ? "text-red-500/70 hover:text-red-500" : "text-foreground/55 hover:text-foreground",
                )}
                title={a.label}
              >
                {a.icon}
                {a.label}
              </button>
            ))}
          </div>
        )}
        </>
        )}
      </PopoverContent>

    </Popover>
  );
}

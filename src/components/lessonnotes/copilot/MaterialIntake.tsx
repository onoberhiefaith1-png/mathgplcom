// Stage 3 of the fixed Copilot procedure — Additional Information.
//
// This stage is OPTIONAL. "Proceed" is a first-class action: the Copilot then
// plans and builds the lesson from the note's own topic and its own knowledge.

import { useRef, useState } from "react";
import { ArrowRight, Loader2, Mic, MicOff, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import AutoTextarea from "@/components/lessonnotes/AutoTextarea";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import type { CoPilotFile, CoPilotMaterial } from "@/lib/lessonnotes/copilot/procedure";

interface Props {
  onSubmit: (material: CoPilotMaterial) => void;
  onSkip: () => void;
  busy?: boolean;
}

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error(`Could not read ${file.name}`));
    fr.readAsDataURL(file);
  });

const MaterialIntake = ({ onSubmit, onSkip, busy }: Props) => {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<CoPilotFile[]>([]);
  const [reading, setReading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const voice = useVoiceInput(setText);

  const attach = async (list: FileList | null) => {
    if (!list?.length) return;
    setReading(true);
    try {
      const next: CoPilotFile[] = [];
      for (const f of Array.from(list).slice(0, 6)) {
        // Keep the payload sane: 8 MB per attachment.
        if (f.size > 8 * 1024 * 1024) continue;
        next.push({ name: f.name, mime: f.type || "application/octet-stream", dataUrl: await readAsDataUrl(f) });
      }
      setFiles((prev) => [...prev, ...next].slice(0, 6));
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const disabled = busy || reading;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2 shadow-sm">
      <p className="text-[9px] uppercase tracking-[0.28em] text-slate-500">
        Additional information · optional
      </p>
      <p className="text-[11.5px] text-slate-600">
        Only if you want to steer the level, style or difficulty: a note, a voice note, a
        photograph of a textbook page, a screenshot or a file. Otherwise choose
        <span className="font-medium text-slate-900"> Proceed</span> and I'll plan the lesson myself.
      </p>

      <AutoTextarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        minRows={2}
        maxRows={7}
        placeholder="Type or dictate your direction for this lesson…"
        className="w-full rounded-lg bg-white border border-slate-300 px-2.5 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-slate-600"
      />

      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-1.5 text-[11.5px] text-slate-700">
              <Paperclip className="h-3 w-3 text-slate-400" />
              <span className="truncate flex-1">{f.name}</span>
              <button
                onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                className="text-slate-400 hover:text-slate-900"
                aria-label={`Remove ${f.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,application/pdf,.txt,.md,.csv"
        className="hidden"
        onChange={(e) => void attach(e.target.files)}
      />

      <div className="flex items-center gap-1.5 pt-0.5">
        <Button
          size="sm" variant="ghost" disabled={disabled}
          className="h-7 gap-1.5 text-[11.5px] text-slate-600 hover:text-slate-900"
          onClick={() => inputRef.current?.click()}
        >
          {reading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />} Attach
        </Button>
        <Button
          size="sm" variant="ghost" disabled={disabled}
          className={`h-7 gap-1.5 text-[11.5px] ${voice.listening ? "text-red-600" : "text-slate-600 hover:text-slate-900"}`}
          onClick={() => (voice.listening ? voice.stop() : voice.start())}
        >
          {voice.transcribing ? <Loader2 className="h-3 w-3 animate-spin" />
            : voice.listening ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
          {voice.listening ? "Stop" : "Voice note"}
        </Button>
        <span className="flex-1" />
        {(text.trim() || files.length > 0) && (
          <Button
            size="sm" variant="outline" disabled={disabled}
            className="h-7 text-[11.5px] border-slate-300 text-slate-800"
            onClick={() => onSubmit({ text: text.trim(), files })}
          >
            Use this
          </Button>
        )}
        <Button
          size="sm"
          disabled={disabled}
          className="h-7 gap-1.5 text-[11.5px] bg-slate-900 text-white hover:bg-slate-800"
          onClick={() => (text.trim() || files.length ? onSubmit({ text: text.trim(), files }) : onSkip())}
        >
          Proceed <ArrowRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};

export default MaterialIntake;

// Stage 3 of the fixed Copilot procedure — Additional Information.
//
// Text, voice note, image, screenshot, textbook page, file or an existing
// question. Skipping is a normal path: the Copilot builds from the note's
// own context when nothing is provided.

import { useRef, useState } from "react";
import { Loader2, Mic, MicOff, Paperclip, X } from "lucide-react";
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
  const voice = useVoiceInput({
    onResult: (t) => setText((prev) => (prev ? `${prev} ${t}` : t)),
  });

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
    <div className="rounded-xl border border-foreground/12 bg-foreground/[0.04] p-3 space-y-2">
      <p className="text-[9px] uppercase tracking-[0.28em] text-foreground/40">Additional information</p>
      <p className="text-[11.5px] text-foreground/60">
        Anything that shows me the level, style and difficulty you want: a note, a voice
        note, a photograph of a textbook page, a screenshot, a file or an existing question.
      </p>

      <AutoTextarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        minRows={2}
        maxRows={7}
        placeholder="Type or dictate your direction for this lesson…"
        className="w-full rounded-lg bg-background/40 border border-foreground/15 px-2.5 py-2 text-[12.5px] text-foreground/90 placeholder:text-foreground/30 outline-none focus:border-amber-300/50"
      />

      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-1.5 text-[11px] text-foreground/70">
              <Paperclip className="h-3 w-3 text-foreground/40" />
              <span className="truncate flex-1">{f.name}</span>
              <button
                onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                className="text-foreground/40 hover:text-foreground"
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
          className="h-7 gap-1.5 text-[11px] text-foreground/65"
          onClick={() => inputRef.current?.click()}
        >
          {reading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />} Attach
        </Button>
        <Button
          size="sm" variant="ghost" disabled={disabled}
          className={`h-7 gap-1.5 text-[11px] ${voice.listening ? "text-red-400" : "text-foreground/65"}`}
          onClick={() => (voice.listening ? voice.stop() : voice.start())}
        >
          {voice.transcribing ? <Loader2 className="h-3 w-3 animate-spin" />
            : voice.listening ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
          {voice.listening ? "Stop" : "Voice note"}
        </Button>
        <span className="flex-1" />
        <Button
          size="sm" variant="ghost" disabled={disabled}
          className="h-7 text-[11px] text-foreground/50"
          onClick={onSkip}
        >
          Skip
        </Button>
        <Button
          size="sm"
          disabled={disabled || (!text.trim() && files.length === 0)}
          className="h-7 text-[11px] bg-amber-400 text-amber-950 hover:bg-amber-300"
          onClick={() => onSubmit({ text: text.trim(), files })}
        >
          Use this
        </Button>
      </div>
    </div>
  );
};

export default MaterialIntake;

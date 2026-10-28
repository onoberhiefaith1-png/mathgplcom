import { useEffect, useRef, useState } from "react";
import { Terminal, X } from "lucide-react";
import { createLabConsole, type ConsoleEntry } from "@/lib/graphApp/console";
import { cn } from "@/lib/utils";

/** MATLAB-style command console for Math Lab. Runs entirely on the device. */
export default function ConsolePanel({
  onPlot,
  onClose,
}: {
  onPlot: (src: string) => void;
  onClose: () => void;
}) {
  const [lab] = useState(createLabConsole);
  const [history, setHistory] = useState<ConsoleEntry[]>([
    { type: "out", text: "Math Lab console — type help for commands" },
  ]);
  const [value, setValue] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [history]);

  const submit = () => {
    const cmd = value.trim();
    if (!cmd) return;
    setValue("");
    const res = lab.run(cmd);
    if (res.entries.length === 0) { setHistory([]); return; } // clc
    setHistory((h) => [...h, ...res.entries]);
    if (res.plot) onPlot(res.plot);
  };

  return (
    <div className="flex h-56 shrink-0 flex-col rounded-xl border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Terminal className="h-4 w-4" /> Console
        </p>
        <button aria-label="Close console" onClick={onClose} className="rounded p-1 hover:bg-muted">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 font-mono text-xs">
        {history.map((e, i) => (
          <pre
            key={i}
            className={cn(
              "whitespace-pre-wrap break-words",
              e.type === "in" && "font-semibold text-primary",
              e.type === "err" && "text-destructive",
              e.type === "plot" && "text-muted-foreground italic",
            )}
          >
            {e.type === "in" ? `>> ${e.text}` : e.type === "plot" ? `plotting ${e.src}` : e.text}
          </pre>
        ))}
        <div ref={endRef} />
      </div>
      <form
        className="flex items-center gap-2 border-t px-3 py-1.5"
        onSubmit={(e) => { e.preventDefault(); submit(); }}
      >
        <span className="font-mono text-sm font-bold text-primary">&gt;&gt;</span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Console command"
          placeholder="A = [1 2; 3 4]   ·   det(A)   ·   plot y = x^2"
          className="h-8 flex-1 bg-transparent font-mono text-sm outline-none"
          autoFocus
        />
      </form>
    </div>
  );
}

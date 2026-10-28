// RelationshipEditorSheet — slide-over editor for relationships attached
// to the current selection. Supports three input modes (Type / Voice /
// Upload), shows AI suggestions as checkbox cards, and merges chosen
// items into the panel. The teacher always approves before anything is
// saved. AI assists; teacher decides.

import { useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, MicOff, Upload, Sparkles, Check, Loader2, X } from "lucide-react";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { genId, type Relationship } from "@/lib/geometry/smart/relationships";
import { cn } from "@/lib/utils";
import type { GeometryScene } from "@/lib/geometry/scene";
import type { SmartPartBase } from "@/lib/geometry/smart/parts";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  scene: GeometryScene;
  topic?: string;
  selectedParts: SmartPartBase[];
  existing: Relationship[];
  onMerge: (chosen: Relationship[]) => void;
}

interface Suggestion {
  name: string;
  formula: string;
  applied?: string;
  explanation: string;
  confidence: "high" | "medium";
}

export function RelationshipEditorSheet({
  open,
  onOpenChange,
  scene,
  topic,
  selectedParts,
  existing,
  onMerge,
}: Props) {
  const [instruction, setInstruction] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [picked, setPicked] = useState<Record<number, boolean>>({});
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { listening, start, stop } = useVoiceInput((updater) => {
    setInstruction((prev) => (typeof updater === "function" ? (updater as (p: string) => string)(prev) : updater));
  });

  const onPickFiles = async (files: FileList | null) => {
    if (!files) return;
    const next: string[] = [];
    for (const f of Array.from(files).slice(0, 4)) {
      if (!f.type.startsWith("image/")) continue;
      const dataUrl: string = await new Promise((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result ?? ""));
        r.readAsDataURL(f);
      });
      if (dataUrl.startsWith("data:image/")) next.push(dataUrl);
    }
    setImages((prev) => [...prev, ...next].slice(0, 4));
  };

  const runAi = async () => {
    if (listening) stop();
    setLoading(true);
    setSuggestions([]);
    setPicked({});
    try {
      const { data, error } = await supabase.functions.invoke("relationship-ai", {
        body: {
          scene,
          topic,
          instruction,
          images,
          selection: selectedParts.map((p) => ({
            kind: p.kind, label: p.label, value: p.value ?? null, unit: p.unit ?? null,
          })),
          existing: existing.map((r) => ({ name: r.name, formula: r.formula })),
        },
      });
      if (error) throw error;
      const list: Suggestion[] = Array.isArray((data as any)?.relationships) ? (data as any).relationships : [];
      setSuggestions(list);
      // Pre-pick all by default — teacher unchecks unwanted ones.
      setPicked(Object.fromEntries(list.map((_, i) => [i, true])));
      if (list.length === 0) toast({ title: "No suggestions returned", description: "Try a more specific instruction." });
    } catch (e: any) {
      toast({ title: "AI error", description: String(e?.message ?? e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const merge = () => {
    const chosen: Relationship[] = suggestions
      .filter((_, i) => picked[i])
      .map((s) => ({
        id: genId(),
        name: s.name,
        formula: s.formula,
        applied: s.applied,
        explanation: s.explanation,
        confidence: s.confidence,
        source: "ai",
      }));
    if (chosen.length === 0) {
      onOpenChange(false);
      return;
    }
    onMerge(chosen);
    onOpenChange(false);
    toast({ title: `${chosen.length} relationship${chosen.length === 1 ? "" : "s"} added` });
    setSuggestions([]);
    setInstruction("");
    setImages([]);
  };

  const addManual = () => {
    onMerge([{
      id: genId(),
      name: "New relationship",
      formula: "",
      explanation: "",
      confidence: "teacher",
      source: "teacher",
    }]);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:max-w-[420px] bg-white text-black border-l border-black/10 overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-black">Edit Relationships (AI)</SheetTitle>
          <SheetDescription className="text-black/60">
            AI suggests — you decide. Type, speak, or upload notes; pick the relationships to keep.
          </SheetDescription>
        </SheetHeader>

        {/* Selection chips */}
        <div className="mt-3 flex flex-wrap gap-1">
          {selectedParts.map((p) => (
            <span key={p.id} className="text-[11px] px-1.5 py-0.5 rounded border border-yellow-400 bg-yellow-100 text-black">
              {p.label}
            </span>
          ))}
        </div>

        {/* Instruction box */}
        <div className="mt-3">
          <label className="text-[11px] uppercase tracking-wide text-black/60">Instruction</label>
          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="e.g. Add the theorem about the angle in a semicircle. Use WAEC wording."
            className="mt-1 min-h-[90px] bg-white text-black border-black/15 focus-visible:ring-yellow-400"
          />
          <div className="flex items-center gap-2 mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => (listening ? stop() : start())}
              className={cn(
                "border-black/15 text-black hover:bg-yellow-100",
                listening && "bg-yellow-200 animate-pulse",
              )}
            >
              {listening ? <MicOff className="h-3.5 w-3.5 mr-1" /> : <Mic className="h-3.5 w-3.5 mr-1" />}
              {listening ? "Stop" : "Voice"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              className="border-black/15 text-black hover:bg-yellow-100"
            >
              <Upload className="h-3.5 w-3.5 mr-1" /> Upload
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => { onPickFiles(e.target.files); e.target.value = ""; }}
            />
            <div className="ml-auto" />
            <Button
              type="button"
              size="sm"
              onClick={runAi}
              disabled={loading}
              className="bg-yellow-400 text-black hover:bg-yellow-300"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
              Suggest
            </Button>
          </div>
          {images.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {images.map((src, i) => (
                <div key={i} className="relative">
                  <img src={src} alt="" className="h-12 w-12 object-cover rounded border border-black/15" />
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute -top-1 -right-1 bg-white border border-black/20 rounded-full h-4 w-4 inline-flex items-center justify-center"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Suggestions */}
        <div className="mt-4 space-y-2">
          {suggestions.map((s, i) => (
            <label
              key={i}
              className={cn(
                "block rounded-md border p-2 cursor-pointer transition",
                picked[i]
                  ? "border-yellow-400 bg-yellow-50"
                  : "border-black/10 bg-white hover:bg-black/[0.02]",
              )}
            >
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1 accent-yellow-500"
                  checked={!!picked[i]}
                  onChange={(e) => setPicked((p) => ({ ...p, [i]: e.target.checked }))}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-semibold text-black">{s.name}</span>
                    <ConfidenceBadge level={s.confidence} />
                  </div>
                  <div className="text-[11px] font-mono text-black/80">{s.applied || s.formula}</div>
                  <div className="text-[11px] text-black/60 mt-0.5">{s.explanation}</div>
                </div>
              </div>
            </label>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-4 flex gap-2 sticky bottom-0 bg-white pt-2 border-t border-black/10">
          <Button type="button" variant="outline" size="sm" onClick={addManual} className="border-black/15 text-black hover:bg-yellow-100">
            Add blank
          </Button>
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-black hover:bg-black/5">
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={merge}
              disabled={suggestions.length === 0}
              className="bg-yellow-400 text-black hover:bg-yellow-300"
            >
              <Check className="h-3.5 w-3.5 mr-1" /> Keep selected
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ConfidenceBadge({ level }: { level: "high" | "medium" | "teacher" }) {
  const map = {
    high: { label: "High", dot: "bg-green-500", border: "border-green-300", bg: "bg-green-50" },
    medium: { label: "Possible", dot: "bg-yellow-500", border: "border-yellow-300", bg: "bg-yellow-50" },
    teacher: { label: "Teacher", dot: "bg-blue-500", border: "border-blue-300", bg: "bg-blue-50" },
  } as const;
  const c = map[level];
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border", c.border, c.bg, "text-black/70")}>
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
      {c.label}
    </span>
  );
}

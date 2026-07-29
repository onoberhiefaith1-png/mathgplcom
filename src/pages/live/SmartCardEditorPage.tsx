// Smart Card Editor — MathGPL Life.
//
// Prepares the PUBLISHED version of a Lesson Note question. Nothing edited
// here ever touches the lesson note; the card carries its own snapshot.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  Undo2, Redo2, Copy, ClipboardPaste, Loader2, Rocket, Check, Share2, Minus, Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import SmartCardQuestion from "@/components/smartcards/SmartCardView";
import {
  cardUrl, loadSmartCard, publishSmartCard, saveSmartCard,
  type CardPresentation, type SmartCardRow,
} from "@/lib/smartcards/smartCards";

const STEP = 0.1;
const clamp = (v: number) => Math.max(0.3, Math.min(4, Number(v.toFixed(2))));

const ScaleRow = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-xs text-muted-foreground">{label}</span>
    <div className="flex items-center gap-1">
      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onChange(clamp(value - STEP))}>
        <Minus className="h-3 w-3" />
      </Button>
      <span className="w-12 text-center text-xs tabular-nums">{Math.round(value * 100)}%</span>
      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => onChange(clamp(value + STEP))}>
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  </div>
);

const SmartCardEditorPage = () => {
  const { cardId } = useParams<{ cardId: string }>();
  const navigate = useNavigate();
  const [card, setCard] = useState<SmartCardRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState(false);

  const [title, setTitle] = useState("");
  const [pres, setPres] = useState<CardPresentation | null>(null);
  const past = useRef<CardPresentation[]>([]);
  const future = useRef<CardPresentation[]>([]);

  useEffect(() => {
    (async () => {
      if (!cardId) return;
      const row = await loadSmartCard(cardId);
      if (!row) { navigate("/live"); return; }
      setCard(row);
      setTitle(row.title);
      setPres(row.presentation);
      setLoading(false);
    })();
  }, [cardId, navigate]);

  const patch = useCallback((next: Partial<CardPresentation>) => {
    setPres((prev) => {
      if (!prev) return prev;
      past.current = [...past.current.slice(-40), prev];
      future.current = [];
      return { ...prev, ...next };
    });
  }, []);

  const undo = useCallback(() => {
    setPres((prev) => {
      const last = past.current.pop();
      if (!last || !prev) return prev;
      future.current = [prev, ...future.current];
      return last;
    });
  }, []);

  const redo = useCallback(() => {
    setPres((prev) => {
      const [next, ...rest] = future.current;
      if (!next || !prev) return prev;
      future.current = rest;
      past.current = [...past.current, prev];
      return next;
    });
  }, []);

  // Autosave the presentation (never the lesson note).
  useEffect(() => {
    if (!cardId || !pres) return;
    const t = setTimeout(() => { void saveSmartCard(cardId, { title, presentation: pres }); }, 600);
    return () => clearTimeout(t);
  }, [cardId, pres, title]);

  const scenes = useMemo(() => card?.geometry?.scenes ?? [], [card]);
  const url = card?.slug ? cardUrl(card.slug) : "";

  const onPublish = async () => {
    if (!card || !pres) return;
    setPublishing(true);
    try {
      await saveSmartCard(card.id, { title, presentation: pres });
      const updated = await publishSmartCard({ ...card, title, presentation: pres });
      if (updated) {
        setCard(updated);
        toast({ title: "Smart Card published", description: "Copy or share it anywhere." });
      }
    } catch (e) {
      toast({
        title: "Could not publish",
        description: (e as Error).message === "no_floating_lines"
          ? "Add floating numbers to the solution first — the challenge needs markable lines."
          : (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setPublishing(false);
    }
  };

  const copyCard = async () => {
    if (!url) return;
    await navigator.clipboard?.writeText(`${title}\n${url}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const shareCard = async () => {
    if (!url) return;
    if (navigator.share) {
      try { await navigator.share({ title, text: title, url }); return; } catch { /* cancelled */ }
    }
    await copyCard();
  };

  if (loading || !pres || !card) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Opening Smart Card…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-card/95 px-4 py-2 backdrop-blur">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <h1 className="text-sm font-semibold">Smart Card Editor</h1>
        <div className="ml-auto flex items-center gap-2">
          {card.published && (
            <>
              <Button variant="outline" size="sm" onClick={copyCard}>
                {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
                Copy Smart Card
              </Button>
              <Button variant="outline" size="sm" onClick={shareCard}>
                <Share2 className="mr-1 h-4 w-4" /> Share Smart Card
              </Button>
            </>
          )}
          <Button size="sm" onClick={onPublish} disabled={publishing}>
            {publishing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Rocket className="mr-1 h-4 w-4" />}
            {card.published ? "Republish Smart Card" : "Publish Smart Card"}
          </Button>
        </div>
      </header>

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Editing + live preview */}
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-4">
            <Label className="text-xs">Card title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 bg-muted" />
            <Label className="mt-3 block text-xs">Question</Label>
            <Textarea
              value={pres.questionText}
              onChange={(e) => patch({ questionText: e.target.value })}
              rows={5}
              className="mt-1 bg-muted font-serif"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Editing here changes the Smart Card only — the lesson note is untouched.
            </p>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Card preview</span>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-muted-foreground">Zoom</span>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => patch({ zoom: clamp((pres.zoom || 1) - STEP) })}>
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-10 text-center text-xs tabular-nums">{Math.round((pres.zoom || 1) * 100)}%</span>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => patch({ zoom: clamp((pres.zoom || 1) + STEP) })}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="flex justify-center overflow-auto rounded-lg bg-muted/40 p-6">
              <div
                className="w-full max-w-xl rounded-2xl border bg-white p-8 shadow-lg"
                style={{ transform: `scale(${pres.zoom || 1})`, transformOrigin: "top center" }}
              >
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  MathGPL Life · Smart Card
                </p>
                <h2 className="mb-4 text-lg font-bold text-slate-900">{title}</h2>
                <SmartCardQuestion presentation={pres} scenes={scenes} />
                <div className="mt-6 rounded-full bg-slate-900 px-5 py-2 text-center text-sm font-semibold text-white">
                  Start Challenge
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Presentation controls */}
        <aside className="space-y-4">
          <div className="space-y-3 rounded-xl border bg-card p-4">
            <span className="text-xs font-medium text-muted-foreground">Text</span>
            <div className="flex flex-wrap gap-1">
              <Button size="icon" variant={pres.bold ? "default" : "outline"} className="h-8 w-8" onClick={() => patch({ bold: !pres.bold })}>
                <Bold className="h-4 w-4" />
              </Button>
              <Button size="icon" variant={pres.italic ? "default" : "outline"} className="h-8 w-8" onClick={() => patch({ italic: !pres.italic })}>
                <Italic className="h-4 w-4" />
              </Button>
              <Button size="icon" variant={pres.underline ? "default" : "outline"} className="h-8 w-8" onClick={() => patch({ underline: !pres.underline })}>
                <Underline className="h-4 w-4" />
              </Button>
              <Separator orientation="vertical" className="mx-1 h-8" />
              {(["left", "center", "right"] as const).map((a) => (
                <Button
                  key={a}
                  size="icon"
                  variant={pres.align === a ? "default" : "outline"}
                  className="h-8 w-8"
                  onClick={() => patch({ align: a })}
                >
                  {a === "left" ? <AlignLeft className="h-4 w-4" /> : a === "center" ? <AlignCenter className="h-4 w-4" /> : <AlignRight className="h-4 w-4" />}
                </Button>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Text colour</span>
              <input
                type="color"
                value={pres.color}
                onChange={(e) => patch({ color: e.target.value })}
                className="h-8 w-12 cursor-pointer rounded border"
              />
            </div>
            <ScaleRow label="Text size" value={pres.fontScale} onChange={(v) => patch({ fontScale: v })} />
            <ScaleRow label="Emoji size" value={pres.emojiScale} onChange={(v) => patch({ emojiScale: v })} />
            <ScaleRow label="Maths size" value={pres.mathScale} onChange={(v) => patch({ mathScale: v })} />
          </div>

          {scenes.length > 0 && (
            <div className="space-y-3 rounded-xl border bg-card p-4">
              <span className="text-xs font-medium text-muted-foreground">Diagram</span>
              <ScaleRow label="Diagram size" value={pres.diagramScale} onChange={(v) => patch({ diagramScale: v })} />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Position</span>
                <div className="flex items-center gap-1">
                  <Input
                    type="number" value={pres.diagramOffsetX}
                    onChange={(e) => patch({ diagramOffsetX: Number(e.target.value) })}
                    className="h-8 w-16 bg-muted text-xs"
                  />
                  <Input
                    type="number" value={pres.diagramOffsetY}
                    onChange={(e) => patch({ diagramOffsetY: Number(e.target.value) })}
                    className="h-8 w-16 bg-muted text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-1 rounded-xl border bg-card p-4">
            <Button size="sm" variant="outline" onClick={undo}><Undo2 className="mr-1 h-3.5 w-3.5" /> Undo</Button>
            <Button size="sm" variant="outline" onClick={redo}><Redo2 className="mr-1 h-3.5 w-3.5" /> Redo</Button>
            <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(pres.questionText)}>
              <Copy className="mr-1 h-3.5 w-3.5" /> Copy
            </Button>
            <Button
              size="sm" variant="outline"
              onClick={async () => {
                const t = await navigator.clipboard?.readText();
                if (t) patch({ questionText: `${pres.questionText}${t}` });
              }}
            >
              <ClipboardPaste className="mr-1 h-3.5 w-3.5" /> Paste
            </Button>
            <Button size="sm" variant="outline" onClick={() => patch({ questionText: `${pres.questionText}\n${pres.questionText}` })}>
              Duplicate
            </Button>
          </div>

          {card.published && (
            <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4 text-xs">
              <p className="font-semibold text-green-700">Smart Card Published</p>
              <p className="mt-1 text-muted-foreground">
                Share it anywhere — supported platforms show the card preview automatically.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default SmartCardEditorPage;

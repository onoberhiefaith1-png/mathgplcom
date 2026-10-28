// Lesson Mode: Faces, Edges & Vertices.
//
// Annotation-first: the diagram starts completely bare. The teacher picks a
// tool ("Add Vertex Label"), clicks the element on the solid, types the name
// (A, B, C…) and presses Enter. Nothing appears until it is created.

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { DoorClosed, DoorOpen, Eraser, Eye, EyeOff, Highlighter, Pencil, RotateCcw, Square, Spline, Dot, Sliders, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { topologyFor, type ElementKind } from "@/lib/geometry3d/topology";
import { openFacesOf } from "@/lib/geometry3d/openFaces";

import { HIGHLIGHT_COLORS } from "../SolidElements";
import type { Annotation3D, AnnotationStyle, Solid3D } from "@/lib/geometry3d/scene3d";

interface Props {
  solid: Solid3D | null;
  annotations: Annotation3D[];
  pickKind: ElementKind;
  onPickKind: (k: ElementKind) => void;
  active: { kind: ElementKind; index: number } | null;
  clearActive: () => void;
  showLabels: boolean;
  onShowLabels: (v: boolean) => void;
  onHighlight: (kind: ElementKind, index: number, color: string | null, style?: AnnotationStyle) => void;
  onLabel: (kind: ElementKind, index: number, text: string | null, style?: AnnotationStyle) => void;
  /** Patch size / density of an annotation that already exists. */
  onStyle: (id: string, patch: AnnotationStyle) => void;
  onClearAll: () => void;
  /** Open / close a face of the selected solid (Open Face). */
  onToggleFace?: (index: number) => void;
  onResetFaces?: () => void;

}

/** Default label text size and colour density used for newly added labels. */
const DEFAULT_SIZE = 0.16;
const DEFAULT_DENSITY = 1;


const TOOLS: { kind: ElementKind; label: string; icon: typeof Square }[] = [
  { kind: "vertex", label: "Add Vertex Label", icon: Dot },
  { kind: "edge", label: "Add Edge Label", icon: Spline },
  { kind: "face", label: "Add Face Label", icon: Square },
];

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function FacesEdgesVerticesTools({
  solid, annotations, pickKind, onPickKind, active, clearActive,
  showLabels, onShowLabels, onHighlight, onLabel, onStyle, onClearAll,
  onToggleFace, onResetFaces,
}: Props) {
  const openFaces = solid ? openFacesOf(solid) : [];
  const isSolidDisplay = solid?.style?.display === "solid";

  const [tool, setTool] = useState<ElementKind | null>(null);
  const [draft, setDraft] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [color, setColor] = useState(HIGHLIGHT_COLORS[0]);
  const [size, setSize] = useState(DEFAULT_SIZE);
  const [density, setDensity] = useState(DEFAULT_DENSITY);
  const [tuning, setTuning] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const topo = useMemo(() => (solid ? topologyFor(solid) : null), [solid]);

  const labels = annotations.filter((a) => a.type === "label");
  const used = new Set(labels.map((a) => (a.text ?? "").trim().toUpperCase()));

  const pending = tool && active && active.kind === tool ? active : null;
  const pendingKey = pending ? `${pending.kind}:${pending.index}` : "";

  // Suggest the next unused letter the moment an element is picked.
  useEffect(() => {
    if (!pending) return;
    const existing = labels.find((a) => a.target.kind === pending.kind && a.target.index === pending.index);
    const next = LETTERS.split("").find((l) => !used.has(l)) ?? "";
    setDraft(existing?.text ?? next);
    const id = requestAnimationFrame(() => inputRef.current?.select());
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKey]);

  if (!solid || !topo) {
    return (
      <div className="h-full border-l border-foreground/10 bg-background p-4">
        <p className="text-xs text-muted-foreground">
          Click a solid in the workspace to teach its faces, edges and vertices.
        </p>
      </div>
    );
  }

  const chooseTool = (k: ElementKind) => {
    const next = tool === k ? null : k;
    setTool(next);
    clearActive();
    if (next) onPickKind(next);
  };

  const commit = () => {
    if (!pending) return;
    const text = draft.trim();
    onLabel(pending.kind, pending.index, text === "" ? null : text, { labelSize: size, opacity: density });
    setDraft("");
    clearActive();
  };

  const nameOf = (a: Annotation3D) => a.text ?? "";
  const kindLabel = (k?: string) => (k === "vertex" ? "Vertex" : k === "edge" ? "Edge" : "Face");

  const activeHighlight = active
    ? annotations.find((a) => a.type === "highlight" && a.target.kind === active.kind && a.target.index === active.index)
    : null;

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto border-l border-foreground/10 bg-background p-3">
      <div>
        <p className="text-sm font-semibold">Faces, Edges & Vertices</p>
        <p className="text-[11px] text-muted-foreground">
          The diagram stays bare — add each label yourself, one step at a time.
        </p>
      </div>

      <div className="space-y-1">
        <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Annotation tools</Label>
        {TOOLS.map((t) => (
          <button
            key={t.kind}
            type="button"
            onClick={() => chooseTool(t.kind)}
            className={cn(
              "flex w-full items-center gap-2 rounded border px-2 py-1.5 text-xs transition",
              tool === t.kind
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:bg-muted",
            )}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
        <p className="text-[10px] text-muted-foreground">
          {tool
            ? `Click a ${tool} on the solid, type the name, then press Enter.`
            : "Choose a tool to begin."}
        </p>
      </div>

      {pending && (
        <div className="rounded-md border border-primary/60 bg-primary/5 p-2">
          <Label className="text-[11px] text-muted-foreground">
            Label for this {pending.kind}
          </Label>
          <div className="mt-1 flex gap-1.5">
            <Input
              ref={inputRef}
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commit(); }
                if (e.key === "Escape") { setDraft(""); clearActive(); }
              }}
              className="h-7 text-xs"
              placeholder="A"
            />
            <Button size="sm" className="h-7 text-xs" onClick={commit}>Enter</Button>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Highlight colour ${c}`}
                onClick={() => setColor(c)}
                className={cn("h-4 w-4 rounded-full border-2", color === c ? "border-foreground" : "border-transparent")}
                style={{ backgroundColor: c }}
              />
            ))}
            <Button
              size="sm" variant="outline" className="ml-auto h-6 gap-1 text-[10px]"
              onClick={() =>
                onHighlight(pending.kind, pending.index, activeHighlight ? null : color, { opacity: density })
              }
            >
              <Highlighter className="h-3 w-3" /> {activeHighlight ? "Unshade" : "Shade"}
            </Button>
          </div>

          {/* Size and colour density for this label / shade */}
          <div className="mt-2 space-y-1.5">
            <div>
              <Label className="text-[10px] text-muted-foreground">
                Size {Math.round(size * 100)}
              </Label>
              <Slider
                value={[size]} min={0.08} max={0.4} step={0.01}
                onValueChange={([v]) => {
                  setSize(v);
                  const existing = labels.find(
                    (a) => a.target.kind === pending.kind && a.target.index === pending.index,
                  );
                  if (existing) onStyle(existing.id, { labelSize: v });
                }}
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">
                Density {Math.round(density * 100)}%
              </Label>
              <Slider
                value={[density]} min={0.1} max={1} step={0.05}
                onValueChange={([v]) => {
                  setDensity(v);
                  const targets = annotations.filter(
                    (a) =>
                      (a.type === "label" || a.type === "highlight") &&
                      a.target.kind === pending.kind && a.target.index === pending.index,
                  );
                  targets.forEach((t) => onStyle(t.id, { opacity: v }));
                }}
              />
            </div>
          </div>
        </div>
      )}


      <Separator />

      <div>
        <Label className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">
          Labels added ({labels.length})
        </Label>
        {labels.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">Nothing labelled yet.</p>
        ) : (
          <div className="space-y-1">
            {labels.map((a) => (
              <div key={a.id} className="rounded border border-border/70">
                <div className="flex items-center gap-1.5 px-2 py-1">
                {renaming === a.id ? (
                  <Input
                    autoFocus
                    defaultValue={nameOf(a)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        onLabel(a.target.kind as ElementKind, a.target.index!, (e.target as HTMLInputElement).value.trim() || null);
                        setRenaming(null);
                      }
                      if (e.key === "Escape") setRenaming(null);
                    }}
                    onBlur={() => setRenaming(null)}
                    className="h-6 text-xs"
                  />
                ) : (
                  <>
                    <span className="text-[10px] uppercase text-muted-foreground">{kindLabel(a.target.kind)}</span>
                    <span className="text-xs font-semibold">{nameOf(a)}</span>
                    <button
                      type="button" title="Size & density"
                      onClick={() => setTuning(tuning === a.id ? null : a.id)}
                      className={cn("ml-auto rounded p-0.5 hover:bg-muted", tuning === a.id && "bg-muted")}
                    >
                      <Sliders className="h-3 w-3" />
                    </button>
                    <button
                      type="button" title="Rename"
                      onClick={() => setRenaming(a.id)}
                      className="rounded p-0.5 hover:bg-muted"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button" title="Remove label"
                      onClick={() => onLabel(a.target.kind as ElementKind, a.target.index!, null)}
                      className="rounded p-0.5 hover:bg-destructive/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </>
                )}
                </div>

                {tuning === a.id && (
                  <div className="space-y-1.5 border-t border-border/70 px-2 py-1.5">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">
                        Size {Math.round((a.style?.labelSize ?? DEFAULT_SIZE) * 100)}
                      </Label>
                      <Slider
                        value={[a.style?.labelSize ?? DEFAULT_SIZE]}
                        min={0.08} max={0.4} step={0.01}
                        onValueChange={([v]) => onStyle(a.id, { labelSize: v })}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">
                        Density {Math.round((a.style?.opacity ?? DEFAULT_DENSITY) * 100)}%
                      </Label>
                      <Slider
                        value={[a.style?.opacity ?? DEFAULT_DENSITY]}
                        min={0.1} max={1} step={0.05}
                        onValueChange={([v]) => {
                          onStyle(a.id, { opacity: v });
                          const shade = annotations.find(
                            (h) => h.type === "highlight" && h.target.kind === a.target.kind && h.target.index === a.target.index,
                          );
                          if (shade) onStyle(shade.id, { opacity: v });
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}

          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5 text-xs">
          {showLabels ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {showLabels ? "Labels visible" : "Labels hidden"}
        </Label>
        <Switch checked={showLabels} onCheckedChange={onShowLabels} />
      </div>

      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs text-destructive" onClick={onClearAll}>
        <Eraser className="h-3.5 w-3.5" /> Remove all annotations
      </Button>

      <Separator />

      {/* Face Actions — Open Face turns the solid into an inspectable container. */}
      <div className="space-y-1.5 rounded-md border border-border p-2">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Face actions</p>

        {!isSolidDisplay ? (
          <p className="text-[11px] text-muted-foreground">
            Switch the object to <span className="font-semibold">Solid</span> to open a face —
            a wireframe has no surface to open.
          </p>
        ) : (
          <>
            <button
              type="button"
              onClick={() => { setTool(null); clearActive(); onPickKind("face"); }}
              className={cn(
                "flex w-full items-center gap-2 rounded border px-2 py-1.5 text-xs transition",
                !tool && pickKind === "face"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-muted",
              )}
            >
              <Square className="h-3.5 w-3.5" /> Select face
            </button>

            <div className="flex gap-1.5">
              <Button
                size="sm"
                className="h-8 flex-1 gap-1 text-xs"
                disabled={!active || active.kind !== "face"}
                onClick={() => {
                  if (!active || active.kind !== "face") return;
                  onToggleFace?.(active.index);
                }}
              >
                {active && active.kind === "face" && openFaces.includes(active.index) ? (
                  <><DoorClosed className="h-3.5 w-3.5" /> Close Face</>
                ) : (
                  <><DoorOpen className="h-3.5 w-3.5" /> Open Face</>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                disabled={openFaces.length === 0}
                onClick={() => onResetFaces?.()}
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </Button>
            </div>

            <p className="text-[10px] text-muted-foreground">
              {active && active.kind === "face"
                ? `${topo.faces[active.index]?.label ?? "Face"} selected. `
                : "Click a face on the solid, then Open Face. "}
              {openFaces.length > 0
                ? `${openFaces.length} face${openFaces.length === 1 ? "" : "s"} open — zoom in through the opening to look inside.`
                : "Every face is closed."}
            </p>
          </>
        )}
      </div>

      <Separator />


      <div className="rounded-md border border-border p-2">
        <p className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">Counts (for checking)</p>
        <div className="grid grid-cols-3 gap-1.5 text-center">
          {[
            { label: "Faces", n: topo.faces.length },
            { label: "Edges", n: topo.edges.length },
            { label: "Vertices", n: topo.vertices.length },
          ].map((c) => (
            <div key={c.label} className="rounded bg-muted/60 py-1.5">
              <p className="text-base font-semibold leading-none">{c.n}</p>
              <p className="text-[10px] text-muted-foreground">{c.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default FacesEdgesVerticesTools;

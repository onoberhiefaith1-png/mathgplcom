// Canvases — the presentation workspace of ONE Lesson Note.
// A Canvas is a named container; its Slides are the pages the teacher moves
// through while presenting. The panel is a docked, resizable column inside the
// workspace layout (never an overlay), so every note control stays reachable.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft, Camera, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, FilePlus2,
  Image as ImageIcon, Play, Plus, Trash2, Video, X,
} from "lucide-react";
import { toast } from "sonner";
import type { Editor } from "@tiptap/react";
import { SlideCanvas } from "./SlideCanvas";
import { SlidePlayer } from "./SlidePlayer";
import { SnipOverlay, type SnipResult } from "./SnipOverlay";
import {
  addSlideItem, createCanvas, createSlide, deleteCanvas, deleteSlide, deleteSlideItem,
  listCanvases, listCanvasSlides, listSlideItems, renameCanvas, renameSlide, reorderSlides,
  updateSlideItem, uploadSlideMedia, type Slide, type SlideCanvasRecord, type SlideItem,
} from "@/lib/lessonnotes/slides";

interface Props {
  notebookId: string;
  /** The note sheet element captures are taken from. */
  sheetEl: HTMLElement | null;
  /** The live note editor — captured mathematics stays editable. */
  editor?: Editor | null;
  onClose: () => void;
}

const MIN_W = 320;

export function SlidePanel({ notebookId, sheetEl, editor = null, onClose }: Props) {
  const widthKey = `slide-panel-w:${notebookId}`;
  const [width, setWidth] = useState(() => {
    if (typeof window === "undefined") return 520;
    const saved = Number(window.sessionStorage.getItem(`slide-panel-w:${notebookId}`));
    return saved && saved >= MIN_W ? saved : 520;
  });
  const dragging = useRef(false);

  const [canvases, setCanvases] = useState<SlideCanvasRecord[]>([]);
  const [canvasId, setCanvasId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [naming, setNaming] = useState(false);

  const [slides, setSlides] = useState<Slide[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [items, setItems] = useState<SlideItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [presenting, setPresenting] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const kindRef = useRef<"image" | "video">("image");

  const canvas = canvases.find((d) => d.id === canvasId) ?? null;
  const openIndex = slides.findIndex((s) => s.id === openId);

  /* ------------------------------------------------------------- resize -- */

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const max = Math.max(MIN_W, window.innerWidth * 0.6);
      setWidth(Math.min(max, Math.max(MIN_W, window.innerWidth - e.clientX)));
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") window.sessionStorage.setItem(widthKey, String(width));
  }, [width, widthKey]);

  /* --------------------------------------------------------------- data -- */

  const refreshCanvases = useCallback(async () => {
    try { setCanvases(await listCanvases(notebookId)); }
    catch { toast.error("Could not load canvases"); }
  }, [notebookId]);

  const refreshSlides = useCallback(async (id: string) => {
    try { return setSlides(await listCanvasSlides(id)); }
    catch { toast.error("Could not load the canvas slides"); }
  }, []);

  const refreshItems = useCallback(async (slideId: string) => {
    try { setItems(await listSlideItems(slideId)); }
    catch { toast.error("Could not load slide content"); }
  }, []);

  useEffect(() => { void refreshCanvases(); }, [refreshCanvases]);
  useEffect(() => { if (canvasId) void refreshSlides(canvasId); }, [canvasId, refreshSlides]);
  useEffect(() => { if (openId) void refreshItems(openId); }, [openId, refreshItems]);

  /* ------------------------------------------------------------ canvases -- */

  const addCanvas = async () => {
    const name = newName.trim();
    if (!name) { toast.error("Give the canvas a name first"); return; }
    try {
      const created = await createCanvas(notebookId, name);
      const first = await createSlide(notebookId, created.id, "Slide 1");
      setCanvases((d) => [...d, created]);
      setNewName("");
      setNaming(false);
      setSlides([first]);
      setCanvasId(created.id);
      setOpenId(first.id);
    } catch {
      toast.error("Could not create the canvas");
    }
  };

  const openCanvas = async (id: string) => {
    setCanvasId(id);
    try {
      let rows = await listCanvasSlides(id);
      if (!rows.length) rows = [await createSlide(notebookId, id, "Slide 1")];
      setSlides(rows);
      setOpenId(rows[0].id);
    } catch {
      toast.error("Could not open the canvas");
    }
  };

  const removeCanvas = async (id: string) => {
    try {
      await deleteCanvas(id);
      setCanvases((d) => d.filter((x) => x.id !== id));
      if (canvasId === id) { setCanvasId(null); setOpenId(null); setSlides([]); }
    } catch { toast.error("Could not delete the canvas"); }
  };

  /* ------------------------------------------------------------- slides -- */

  const addSlide = async () => {
    if (!canvasId) return;
    try {
      const slide = await createSlide(notebookId, canvasId, `Slide ${slides.length + 1}`);
      setSlides((s) => [...s, slide]);
      setOpenId(slide.id);
      setItems([]);
    } catch { toast.error("Could not add the slide"); }
  };

  const removeSlide = async (id: string) => {
    try {
      await deleteSlide(id);
      const left = slides.filter((x) => x.id !== id);
      setSlides(left);
      if (openId === id) setOpenId(left[0]?.id ?? null);
    } catch { toast.error("Could not delete the slide"); }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides];
    [next[index], next[target]] = [next[target], next[index]];
    setSlides(next.map((s, i) => ({ ...s, position: i })));
    try { await reorderSlides(next); } catch { if (canvasId) void refreshSlides(canvasId); }
  };

  const step = (dir: -1 | 1) => {
    const target = openIndex + dir;
    if (target < 0 || target >= slides.length) return;
    setOpenId(slides[target].id);
    setSelected(null);
  };

  /* -------------------------------------------------------------- items -- */

  const nextStep = () => (items.length ? Math.max(...items.map((i) => i.step)) : 0) + 1;
  const nextZ = () => (items.length ? Math.max(...items.map((i) => i.z)) : 0) + 1;

  const pickFile = (kind: "image" | "video") => {
    kindRef.current = kind;
    if (fileRef.current) {
      fileRef.current.accept = kind === "image" ? "image/*" : "video/*";
      fileRef.current.value = "";
      fileRef.current.click();
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !openId) return;
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || (kindRef.current === "image" ? "png" : "mp4");
      const path = await uploadSlideMedia(notebookId, openId, file, ext);
      const item = await addSlideItem(openId, {
        kind: kindRef.current,
        storage_path: path,
        x: 0.1, y: 0.1, w: 0.5, h: 0.3,
        z: nextZ(), step: nextStep(),
      });
      setItems((s) => [...s, item]);
      setSelected(item.id);
    } catch {
      toast.error("Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const handleCapture = async (result: SnipResult) => {
    setCapturing(false);
    if (!openId) return;
    setBusy(true);
    try {
      const geometry = { x: result.x, y: result.y, w: result.w, h: result.h };
      let item: SlideItem;
      if (result.content) {
        item = await addSlideItem(openId, {
          kind: "content",
          storage_path: "",
          content_json: result.content,
          ...geometry,
          z: nextZ(), step: nextStep(),
        });
      } else if (result.blob) {
        const path = await uploadSlideMedia(notebookId, openId, result.blob, "png");
        item = await addSlideItem(openId, {
          kind: "screenshot",
          storage_path: path,
          ...geometry,
          z: nextZ(), step: nextStep(),
        });
      } else {
        return;
      }
      setItems((s) => [...s, item]);
      toast.success(`Captured as step ${item.step}`);
    } catch {
      toast.error("Could not save the capture");
    } finally {
      setBusy(false);
    }
  };

  const patchItem = async (id: string, patch: Partial<SlideItem>) => {
    setItems((s) => s.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    try { await updateSlideItem(id, patch); } catch { toast.error("Could not save the change"); }
  };

  const removeItem = async (id: string) => {
    setItems((s) => s.filter((i) => i.id !== id));
    try { await deleteSlideItem(id); } catch { toast.error("Could not delete the element"); }
  };

  // While capturing, the panel is hidden so it can never land in the capture.
  if (capturing) {
    return (
      <SnipOverlay
        sheetEl={sheetEl}
        editor={editor}
        onCancel={() => setCapturing(false)}
        onCapture={handleCapture}
      />
    );
  }

  return (
    <div
      data-slide-chrome="true"
      className="relative flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-l bg-background"
      style={{ width, maxWidth: "60%" }}
    >
      {/* Left-edge resize grip — the note column keeps the remaining width. */}
      <div
        role="separator"
        aria-orientation="vertical"
        title="Drag to resize the slide panel"
        onPointerDown={() => { dragging.current = true; document.body.style.userSelect = "none"; }}
        className="absolute left-0 top-0 h-full w-1.5 -translate-x-1/2 cursor-ew-resize bg-transparent hover:bg-primary/40"
        style={{ touchAction: "none" }}
      />

      <input ref={fileRef} type="file" hidden onChange={handleFile} />

      <header className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
          onClick={onClose}
          title="Close the slide panel and return to the note"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Exit Slide
        </button>
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
          {canvas ? `Canvas: ${canvas.name}` : "My Canvases"}
        </h2>
        {canvas && (
          <button
            type="button"
            className="rounded p-1.5 hover:bg-muted"
            onClick={() => { setCanvasId(null); setOpenId(null); setSlides([]); }}
            title="Back to canvases"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </header>

      {!canvas ? (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3">
          {naming ? (
            <div className="flex items-center gap-2 rounded-lg border p-2">
              <input
                autoFocus
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                placeholder="Canvas name — e.g. Logarithms"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void addCanvas(); }}
              />
              <button
                type="button"
                className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                onClick={() => void addCanvas()}
              >
                Create Canvas
              </button>
              <button
                type="button"
                className="rounded p-1 hover:bg-muted"
                onClick={() => { setNaming(false); setNewName(""); }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setNaming(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-2.5 text-sm font-medium hover:bg-muted"
            >
              <Plus className="h-4 w-4" /> Create Canvas
            </button>
          )}

          {canvases.map((d) => (
            <div key={d.id} className="flex items-center gap-1 rounded-lg border px-2 py-1.5">
              <input
                className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
                value={d.name}
                onChange={(e) =>
                  setCanvases((all) => all.map((x) => (x.id === d.id ? { ...x, name: e.target.value } : x)))
                }
                onBlur={(e) => void renameCanvas(d.id, e.target.value)}
              />
              <button
                type="button"
                className="rounded px-2 py-1 text-xs font-medium hover:bg-muted"
                onClick={() => void openCanvas(d.id)}
              >
                Open
              </button>
              <button
                type="button"
                className="rounded p-1 text-destructive hover:bg-destructive/10"
                onClick={() => void removeCanvas(d.id)}
                title="Delete canvas"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {canvases.length === 0 && !naming && (
            <p className="pt-6 text-center text-xs text-muted-foreground">
              A Canvas is a named presentation — Algebra, Indices, Logarithms — holding
              Slide 1, Slide 2, Slide 3… and it belongs to this lesson note only.
            </p>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Slide navigation across the pages of this one Canvas. */}
          <div className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b px-3 py-1.5">
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={openIndex <= 0}
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </button>
            <span className="truncate text-center text-[11px] font-medium tabular-nums text-muted-foreground">
              Slide {openIndex < 0 ? 0 : openIndex + 1} of {slides.length}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => step(1)}
                disabled={openIndex < 0 || openIndex >= slides.length - 1}
                className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
              {slides.length > 0 && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                  onClick={() => setPresenting(Math.max(0, openIndex))}
                >
                  <Play className="h-3.5 w-3.5" /> Preview
                </button>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b px-3 py-2">
            <button type="button" disabled={busy || !openId} onClick={() => setCapturing(true)}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40">
              <Camera className="h-3.5 w-3.5" /> Capture
            </button>
            <button type="button" disabled={busy || !openId} onClick={() => pickFile("image")}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40">
              <ImageIcon className="h-3.5 w-3.5" /> Import image
            </button>
            <button type="button" disabled={busy || !openId} onClick={() => pickFile("video")}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40">
              <Video className="h-3.5 w-3.5" /> Import video
            </button>
            <button type="button" disabled={busy} onClick={() => void addSlide()}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40">
              <FilePlus2 className="h-3.5 w-3.5" /> Add Slide
            </button>
          </div>

          <div className="flex min-h-0 flex-1">
            {/* The Canvas structure — every slide of this canvas. */}
            <div className="min-h-0 w-40 shrink-0 space-y-1 overflow-y-auto overscroll-contain border-r p-2">
              {slides.map((s, i) => (
                <div
                  key={s.id}
                  className={`rounded-md border px-1.5 py-1 ${openId === s.id ? "border-primary bg-primary/5" : ""}`}
                >
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left text-xs font-medium"
                      onClick={() => { setOpenId(s.id); setSelected(null); }}
                    >
                      {i + 1}. {s.name}
                    </button>
                    <button type="button" className="rounded p-0.5 hover:bg-muted" onClick={() => void move(i, -1)} title="Move up">
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button type="button" className="rounded p-0.5 hover:bg-muted" onClick={() => void move(i, 1)} title="Move down">
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>
                  {openId === s.id && (
                    <div className="mt-1 flex items-center gap-1">
                      <input
                        className="min-w-0 flex-1 rounded bg-muted/60 px-1 py-0.5 text-[11px] outline-none"
                        value={s.name}
                        onChange={(e) =>
                          setSlides((all) => all.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)))
                        }
                        onBlur={(e) => void renameSlide(s.id, e.target.value)}
                      />
                      <button
                        type="button"
                        className="rounded p-0.5 text-destructive hover:bg-destructive/10"
                        onClick={() => void removeSlide(s.id)}
                        title="Delete slide"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-muted/40 p-3">
              {openId ? (
                <>
                  <div className="h-[calc(100%-2.5rem)]">
                    <SlideCanvas
                      items={items}
                      selectedId={selected}
                      onSelect={setSelected}
                      onChange={(id, patch) => void patchItem(id, patch)}
                      onDelete={(id) => void removeItem(id)}
                    />
                  </div>
                  <p className="pt-2 text-[11px] leading-snug text-muted-foreground">
                    Each capture becomes the next reveal step, at its original size. Select an
                    image or video to drag it, resize it from any handle, or fill the slide.
                  </p>
                </>
              ) : (
                <p className="grid h-full place-items-center text-xs text-muted-foreground">
                  Add a slide to start.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {presenting !== null && (
        <SlidePlayer
          slides={slides}
          startIndex={presenting}
          canvasName={canvas?.name}
          onExit={() => setPresenting(null)}
        />
      )}
    </div>
  );
}

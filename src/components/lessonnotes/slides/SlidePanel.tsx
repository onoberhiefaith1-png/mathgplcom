// Slide panel — the Slide workspace of ONE Lesson Note.
// List view: create / rename / reorder / delete / present its slides.
// Editor view: import image or video, snip a screenshot of the note, arrange.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft, Camera, ChevronDown, ChevronUp, Image as ImageIcon, Play, Plus, Trash2, Video, X,
} from "lucide-react";
import { toast } from "sonner";
import { SlideCanvas } from "./SlideCanvas";
import { SlidePlayer } from "./SlidePlayer";
import { SnipOverlay, type SnipResult } from "./SnipOverlay";
import {
  addSlideItem, createSlide, deleteSlide, deleteSlideItem, listSlideItems, listSlides,
  renameSlide, reorderSlides, updateSlideItem, uploadSlideMedia,
  type Slide, type SlideItem,
} from "@/lib/lessonnotes/slides";

interface Props {
  notebookId: string;
  /** The note sheet element that screenshots are cropped from. */
  sheetEl: HTMLElement | null;
  onClose: () => void;
}

export function SlidePanel({ notebookId, sheetEl, onClose }: Props) {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [items, setItems] = useState<SlideItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [snipping, setSnipping] = useState(false);
  const [presenting, setPresenting] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const kindRef = useRef<"image" | "video">("image");

  const refreshSlides = useCallback(async () => {
    try {
      setSlides(await listSlides(notebookId));
    } catch {
      toast.error("Could not load slides");
    }
  }, [notebookId]);

  const refreshItems = useCallback(async (slideId: string) => {
    try {
      setItems(await listSlideItems(slideId));
    } catch {
      toast.error("Could not load slide content");
    }
  }, []);

  useEffect(() => { void refreshSlides(); }, [refreshSlides]);
  useEffect(() => { if (openId) void refreshItems(openId); }, [openId, refreshItems]);

  const addSlide = async () => {
    try {
      const slide = await createSlide(notebookId, `Slide ${slides.length + 1}`);
      setSlides((s) => [...s, slide]);
      setOpenId(slide.id);
    } catch {
      toast.error("Could not create the slide");
    }
  };

  const removeSlide = async (id: string) => {
    try {
      await deleteSlide(id);
      setSlides((s) => s.filter((x) => x.id !== id));
      if (openId === id) setOpenId(null);
    } catch {
      toast.error("Could not delete the slide");
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides];
    [next[index], next[target]] = [next[target], next[index]];
    setSlides(next.map((s, i) => ({ ...s, position: i })));
    try { await reorderSlides(next); } catch { void refreshSlides(); }
  };

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
        x: 0.1, y: 0.1, w: 0.5, h: 0.4,
        z: nextZ(), step: nextStep(),
      });
      setItems((s) => [...s, item]);
    } catch {
      toast.error("Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const handleSnip = async (result: SnipResult) => {
    setSnipping(false);
    if (!openId) return;
    setBusy(true);
    try {
      const path = await uploadSlideMedia(notebookId, openId, result.blob, "png");
      const item = await addSlideItem(openId, {
        kind: "screenshot",
        storage_path: path,
        // Keep the captured geometry so a step sequence lines up on the slide.
        x: result.x, y: result.y, w: result.w, h: result.h,
        z: nextZ(), step: nextStep(),
      });
      setItems((s) => [...s, item]);
      toast.success(`Captured as step ${item.step}`);
    } catch {
      toast.error("Could not save the screenshot");
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

  const openSlide = slides.find((s) => s.id === openId) ?? null;

  // While snipping, the panel is fully hidden so it can never land in the shot.
  if (snipping) {
    return <SnipOverlay sheetEl={sheetEl} onCancel={() => setSnipping(false)} onCapture={handleSnip} />;
  }

  return (
    <div
      data-slide-chrome="true"
      className="fixed right-0 top-0 z-[80] flex h-screen w-[34vw] min-w-[360px] flex-col border-l bg-background shadow-2xl"
    >
      <input ref={fileRef} type="file" hidden onChange={handleFile} />

      <header className="flex items-center gap-2 border-b px-3 py-2">
        {openSlide && (
          <button type="button" className="rounded p-1.5 hover:bg-muted" onClick={() => setOpenId(null)} title="Back to slides">
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <h2 className="flex-1 truncate text-sm font-semibold">
          {openSlide ? openSlide.name : "Slides — this lesson note"}
        </h2>
        {slides.length > 0 && (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            onClick={() => setPresenting(openSlide ? slides.findIndex((s) => s.id === openSlide.id) : 0)}
          >
            <Play className="h-3.5 w-3.5" /> Present
          </button>
        )}
        <button type="button" className="rounded p-1.5 hover:bg-muted" onClick={onClose} title="Close slides">
          <X className="h-4 w-4" />
        </button>
      </header>

      {!openSlide ? (
        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          <button
            type="button"
            onClick={addSlide}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-2.5 text-sm font-medium hover:bg-muted"
          >
            <Plus className="h-4 w-4" /> New slide
          </button>
          {slides.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1 rounded-lg border px-2 py-1.5">
              <span className="w-6 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
              <input
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                value={s.name}
                onChange={(e) =>
                  setSlides((all) => all.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)))
                }
                onBlur={(e) => void renameSlide(s.id, e.target.value)}
              />
              <button type="button" className="rounded p-1 hover:bg-muted" onClick={() => void move(i, -1)} title="Move up">
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button type="button" className="rounded p-1 hover:bg-muted" onClick={() => void move(i, 1)} title="Move down">
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button type="button" className="rounded px-2 py-1 text-xs font-medium hover:bg-muted" onClick={() => setOpenId(s.id)}>
                Open
              </button>
              <button
                type="button"
                className="rounded p-1 text-destructive hover:bg-destructive/10"
                onClick={() => void removeSlide(s.id)}
                title="Delete slide"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {slides.length === 0 && (
            <p className="pt-6 text-center text-xs text-muted-foreground">
              Slides live inside this lesson note only.
            </p>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-1.5 border-b px-3 py-2">
            <button type="button" disabled={busy} onClick={() => setSnipping(true)}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40">
              <Camera className="h-3.5 w-3.5" /> Screenshot
            </button>
            <button type="button" disabled={busy} onClick={() => pickFile("image")}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40">
              <ImageIcon className="h-3.5 w-3.5" /> Import image
            </button>
            <button type="button" disabled={busy} onClick={() => pickFile("video")}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40">
              <Video className="h-3.5 w-3.5" /> Import video
            </button>
          </div>
          <div className="min-h-0 flex-1 bg-muted/40 p-3">
            <div className="mx-auto aspect-[16/9] w-full">
              <SlideCanvas
                items={items}
                selectedId={selected}
                onSelect={setSelected}
                onChange={(id, patch) => void patchItem(id, patch)}
                onDelete={(id) => void removeItem(id)}
              />
            </div>
            <p className="pt-2 text-[11px] leading-snug text-muted-foreground">
              Each capture becomes the next step, so a worked line can be revealed piece by piece
              while presenting.
            </p>
          </div>
        </div>
      )}

      {presenting !== null && (
        <div className="fixed inset-0 z-[9998]">
          <SlidePlayer slides={slides} startIndex={presenting} onExit={() => setPresenting(null)} />
        </div>
      )}
    </div>
  );
}

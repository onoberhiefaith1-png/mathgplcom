// Slide Decks — the presentation workspace of ONE Lesson Note.
// Deck list: name, open, rename, delete, present.
// Deck editor: the deck's slides down the side, the open slide's canvas beside
// them, with Capture / Import image / Import video / Blank canvas.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft, Camera, ChevronDown, ChevronUp, FilePlus2, Image as ImageIcon, Play, Plus,
  Trash2, Video, X,
} from "lucide-react";
import { toast } from "sonner";
import type { Editor } from "@tiptap/react";
import { SlideCanvas } from "./SlideCanvas";
import { SlidePlayer } from "./SlidePlayer";
import { SnipOverlay, type SnipResult } from "./SnipOverlay";
import {
  addSlideItem, createDeck, createSlide, deleteDeck, deleteSlide, deleteSlideItem, listDecks,
  listDeckSlides, listSlideItems, renameDeck, renameSlide, reorderSlides, updateSlideItem,
  uploadSlideMedia, type Slide, type SlideDeck, type SlideItem,
} from "@/lib/lessonnotes/slides";

interface Props {
  notebookId: string;
  /** The note sheet element captures are taken from. */
  sheetEl: HTMLElement | null;
  /** The live note editor — captured mathematics stays editable. */
  editor?: Editor | null;
  onClose: () => void;
}

export function SlidePanel({ notebookId, sheetEl, editor = null, onClose }: Props) {
  const [decks, setDecks] = useState<SlideDeck[]>([]);
  const [deckId, setDeckId] = useState<string | null>(null);
  const [newDeckName, setNewDeckName] = useState("");
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

  const deck = decks.find((d) => d.id === deckId) ?? null;

  const refreshDecks = useCallback(async () => {
    try { setDecks(await listDecks(notebookId)); }
    catch { toast.error("Could not load slide decks"); }
  }, [notebookId]);

  const refreshSlides = useCallback(async (id: string) => {
    try { return setSlides(await listDeckSlides(id)); }
    catch { toast.error("Could not load the deck's slides"); }
  }, []);

  const refreshItems = useCallback(async (slideId: string) => {
    try { setItems(await listSlideItems(slideId)); }
    catch { toast.error("Could not load slide content"); }
  }, []);

  useEffect(() => { void refreshDecks(); }, [refreshDecks]);
  useEffect(() => { if (deckId) void refreshSlides(deckId); }, [deckId, refreshSlides]);
  useEffect(() => { if (openId) void refreshItems(openId); }, [openId, refreshItems]);

  /* ------------------------------------------------------------- decks -- */

  const addDeck = async () => {
    const name = newDeckName.trim();
    if (!name) { toast.error("Give the deck a name first"); return; }
    try {
      const created = await createDeck(notebookId, name);
      const first = await createSlide(notebookId, created.id, "Slide 1");
      setDecks((d) => [...d, created]);
      setNewDeckName("");
      setNaming(false);
      setSlides([first]);
      setDeckId(created.id);
      setOpenId(first.id);
    } catch {
      toast.error("Could not create the deck");
    }
  };

  const openDeck = async (id: string) => {
    setDeckId(id);
    try {
      let rows = await listDeckSlides(id);
      if (!rows.length) rows = [await createSlide(notebookId, id, "Slide 1")];
      setSlides(rows);
      setOpenId(rows[0].id);
    } catch {
      toast.error("Could not open the deck");
    }
  };

  const removeDeck = async (id: string) => {
    try {
      await deleteDeck(id);
      setDecks((d) => d.filter((x) => x.id !== id));
      if (deckId === id) { setDeckId(null); setOpenId(null); setSlides([]); }
    } catch { toast.error("Could not delete the deck"); }
  };

  /* ------------------------------------------------------------ slides -- */

  const addSlide = async () => {
    if (!deckId) return;
    try {
      const slide = await createSlide(notebookId, deckId, `Slide ${slides.length + 1}`);
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
    try { await reorderSlides(next); } catch { if (deckId) void refreshSlides(deckId); }
  };

  /* ------------------------------------------------------------- items -- */

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
      className="fixed right-0 top-0 z-[80] flex h-screen w-[38vw] min-w-[420px] flex-col border-l bg-background shadow-2xl"
    >
      <input ref={fileRef} type="file" hidden onChange={handleFile} />

      <header className="flex items-center gap-2 border-b px-3 py-2">
        {deck && (
          <button
            type="button"
            className="rounded p-1.5 hover:bg-muted"
            onClick={() => { setDeckId(null); setOpenId(null); setSlides([]); }}
            title="Back to slide decks"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <h2 className="flex-1 truncate text-sm font-semibold">
          {deck ? deck.name : "Slide Decks — this lesson note"}
        </h2>
        {deck && slides.length > 0 && (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
            onClick={() => setPresenting(Math.max(0, slides.findIndex((s) => s.id === openId)))}
          >
            <Play className="h-3.5 w-3.5" /> Present
          </button>
        )}
        <button type="button" className="rounded p-1.5 hover:bg-muted" onClick={onClose} title="Close slides">
          <X className="h-4 w-4" />
        </button>
      </header>

      {!deck ? (
        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {naming ? (
            <div className="flex items-center gap-2 rounded-lg border p-2">
              <input
                autoFocus
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                placeholder="Deck name — e.g. Algebra"
                value={newDeckName}
                onChange={(e) => setNewDeckName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void addDeck(); }}
              />
              <button
                type="button"
                className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                onClick={() => void addDeck()}
              >
                Create
              </button>
              <button
                type="button"
                className="rounded p-1 hover:bg-muted"
                onClick={() => { setNaming(false); setNewDeckName(""); }}
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
              <Plus className="h-4 w-4" /> New slide deck
            </button>
          )}

          {decks.map((d) => (
            <div key={d.id} className="flex items-center gap-1 rounded-lg border px-2 py-1.5">
              <input
                className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
                value={d.name}
                onChange={(e) =>
                  setDecks((all) => all.map((x) => (x.id === d.id ? { ...x, name: e.target.value } : x)))
                }
                onBlur={(e) => void renameDeck(d.id, e.target.value)}
              />
              <button
                type="button"
                className="rounded px-2 py-1 text-xs font-medium hover:bg-muted"
                onClick={() => void openDeck(d.id)}
              >
                Open
              </button>
              <button
                type="button"
                className="rounded p-1 text-destructive hover:bg-destructive/10"
                onClick={() => void removeDeck(d.id)}
                title="Delete deck"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {decks.length === 0 && !naming && (
            <p className="pt-6 text-center text-xs text-muted-foreground">
              A slide deck is a named presentation — Algebra, Indices, Logarithms —
              and belongs to this lesson note only.
            </p>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-1.5 border-b px-3 py-2">
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
              <FilePlus2 className="h-3.5 w-3.5" /> Blank canvas
            </button>
          </div>

          <div className="flex min-h-0 flex-1">
            {/* The deck structure — every slide of this deck. */}
            <div className="w-40 shrink-0 space-y-1 overflow-y-auto border-r p-2">
              {slides.map((s, i) => (
                <div
                  key={s.id}
                  className={`rounded-md border px-1.5 py-1 ${openId === s.id ? "border-primary bg-primary/5" : ""}`}
                >
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left text-xs font-medium"
                      onClick={() => setOpenId(s.id)}
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

            <div className="min-h-0 flex-1 bg-muted/40 p-3">
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
                    Each capture becomes the next reveal step, at its original size — so a worked
                    line can be revealed piece by piece while presenting.
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
        <div className="fixed inset-0 z-[9998]">
          <SlidePlayer slides={slides} startIndex={presenting} onExit={() => setPresenting(null)} />
        </div>
      )}
    </div>
  );
}

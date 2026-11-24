import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import { LoaderCircle } from "lucide-react";
import { assignmentEndpoints } from "@/lib/lessonnotes/assignmentEndpoints";
import {
  forcedAssignFrame,
  forcedAssignPhase,
  normalAssignCoversRange,
  parseForcedMcq,
  type ForcedMcq,
} from "@/lib/lessonnotes/forcedAssign";

export type ForcedAssignKind = "mcq" | "floating";

export type ForcedAssignSnapshot = {
  from: number;
  to: number;
  text: string;
  parsed: ForcedMcq;
};

type Anchor = { top: number; left: number; maxWidth: number };

function selectionAnchor(editor: Editor, to: number): Anchor | null {
  try {
    const coords = editor.view.coordsAtPos(Math.max(0, Math.min(to, editor.state.doc.content.size)));
    const box = editor.view.dom.closest(".lesson-doc")?.getBoundingClientRect()
      ?? editor.view.dom.getBoundingClientRect();
    return { top: coords.top, ...forcedAssignFrame(box) };
  } catch {
    return null;
  }
}

export function ForcedAssignMarker({
  editor,
  aiEditOpen,
  onChoose,
}: {
  editor: Editor | null;
  aiEditOpen: boolean;
  onChoose: (kind: ForcedAssignKind, snap: ForcedAssignSnapshot) => void | Promise<void>;
}) {
  const [highlighting, setHighlighting] = useState(false);
  const [snap, setSnap] = useState<ForcedAssignSnapshot | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [loading, setLoading] = useState<ForcedAssignKind | null>(null);
  const snapRef = useRef(snap);
  snapRef.current = snap;
  const loadingRef = useRef(loading);
  loadingRef.current = loading;
  const markerRef = useRef<HTMLDivElement | null>(null);
  // True from a press on the marker until the next press elsewhere. Touch
  // browsers can collapse the highlight when a pill is tapped; the marker
  // keeps its snapshot so MCQ / Floating still work.
  const usingMarkerRef = useRef(false);

  useEffect(() => {
    if (!editor) return;
    const capture = (from: number, to: number): ForcedAssignSnapshot | null => {
      if (to <= from) return null;
      const text = editor.state.doc.textBetween(from, to, "\n", (leaf: { attrs?: { value?: string } }) => {
        const value = leaf?.attrs?.value;
        return typeof value === "string" ? value : "";
      });
      if (!text.trim()) return null;
      return { from, to, text, parsed: parseForcedMcq(text) };
    };
    const place = (to: number) => setAnchor(selectionAnchor(editor, to));
    const clear = () => {
      if (loadingRef.current || usingMarkerRef.current) return;
      setSnap(null);
      setAnchor(null);
    };
    // Mirror the live highlight: show and move while text is highlighted,
    // go away once the highlight is gone.
    const sync = () => {
      if (editor.isDestroyed) return;
      const { from, to, empty } = editor.state.selection;
      const next = empty ? null : capture(from, to);
      if (!next) { clear(); return; }
      setSnap(next);
      place(to);
    };
    const onMarker = (target: EventTarget | null) =>
      !!markerRef.current && target instanceof Node && markerRef.current.contains(target);
    const onPointerDown = (event: PointerEvent) => {
      if (onMarker(event.target)) { usingMarkerRef.current = true; return; }
      usingMarkerRef.current = false;
      // A new drag inside the notes: the marker follows it.
      if (event.target instanceof Node && editor.view.dom.contains(event.target)) setHighlighting(true);
    };
    const onPointerUp = (event: PointerEvent) => {
      setHighlighting(false);
      if (onMarker(event.target)) return;
      sync();
    };
    const reposition = () => {
      const current = snapRef.current;
      if (current) place(current.to);
    };
    sync();
    editor.on("selectionUpdate", sync);
    editor.on("transaction", sync);
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      editor.off("selectionUpdate", sync);
      editor.off("transaction", sync);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [editor]);

  useEffect(() => {
    if (aiEditOpen) {
      usingMarkerRef.current = false;
      setSnap(null);
      setAnchor(null);
      setLoading(null);
    }
  }, [aiEditOpen]);

  if (!editor || !snap || !anchor) return null;
  const endpoints = assignmentEndpoints(editor.state.doc);
  const normalAssignHere = normalAssignCoversRange(endpoints, snap.from, snap.to);
  const phase = forcedAssignPhase({
    highlighting,
    hasHighlight: true,
    normalAssignHere,
    aiEditOpen,
    loading: !!loading,
  });
  if (phase === "hidden") return null;

  const choose = (kind: ForcedAssignKind) => {
    if (loading) return;
    setLoading(kind);
    void Promise.resolve(onChoose(kind, snap)).finally(() => {
      usingMarkerRef.current = false;
      setLoading(null);
      setSnap(null);
      setAnchor(null);
    });
  };

  return createPortal(
    <div
      data-testid="forced-assign-marker"
      ref={markerRef}
      data-phase={phase}
      data-normal-assign={normalAssignHere ? "true" : undefined}
      className="forced-assign-marker print:hidden"
      style={{ top: anchor.top, left: anchor.left, width: anchor.maxWidth, maxWidth: anchor.maxWidth }}
      onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
    >
      <span className="forced-assign-label">{phase === "loading" ? "Reading…" : "Assign"}</span>
      <button type="button" data-testid="forced-assign-mcq" className="forced-assign-choice" disabled={!!loading}
        onClick={() => choose("mcq")}>
        {loading === "mcq" ? <LoaderCircle className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden="true" /> : null}
        MCQ
      </button>
      <button type="button" data-testid="forced-assign-floating" className="forced-assign-choice" disabled={!!loading}
        onClick={() => choose("floating")}>
        {loading === "floating" ? <LoaderCircle className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden="true" /> : null}
        Floating
      </button>
    </div>,
    document.body,
  );
}

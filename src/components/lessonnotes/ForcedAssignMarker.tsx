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
    const onUpdate = () => {
      const { from, to, empty } = editor.state.selection;
      if (!empty && to > from) {
        const next = capture(from, to);
        if (next) {
          setSnap(next);
          place(to);
        }
      }
    };
    const onPointerDown = () => {
      if (editor.state.selection.empty) return;
      setHighlighting(true);
    };
    const onPointerUp = () => {
      setHighlighting(false);
      const { from, to, empty } = editor.state.selection;
      if (!empty) {
        const next = capture(from, to);
        if (next) {
          setSnap(next);
          place(to);
        }
      }
    };
    onUpdate();
    editor.on("selectionUpdate", onUpdate);
    editor.on("transaction", onUpdate);
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("scroll", () => { const current = snapRef.current; if (current) place(current.to); }, true);
    window.addEventListener("resize", () => { const current = snapRef.current; if (current) place(current.to); });
    return () => {
      editor.off("selectionUpdate", onUpdate);
      editor.off("transaction", onUpdate);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointerup", onPointerUp, true);
    };
  }, [editor]);

  useEffect(() => {
    if (aiEditOpen) {
      setSnap(null);
      setAnchor(null);
      setLoading(null);
    }
  }, [aiEditOpen]);

  if (!editor || !snap || !anchor) return null;
  const endpoints = assignmentEndpoints(editor.state.doc);
  const phase = forcedAssignPhase({
    highlighting,
    hasHighlight: true,
    normalAssignHere: normalAssignCoversRange(endpoints, snap.from, snap.to),
    aiEditOpen,
    loading: !!loading,
  });
  if (phase === "hidden") return null;

  const choose = (kind: ForcedAssignKind) => {
    if (loading) return;
    setLoading(kind);
    void Promise.resolve(onChoose(kind, snap)).finally(() => {
      setLoading(null);
      setSnap(null);
      setAnchor(null);
    });
  };

  return createPortal(
    <div
      data-testid="forced-assign-marker"
      data-phase={phase}
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

// BOARD B — the teacher's working copy of the Lesson Note.
//
// It is NOT a special board with its own tool system, and it is not an
// extraction area. It is another instance of the existing Lesson Note editor
// holding an independent DUPLICATE of the note currently on the board:
// headings, text, equations, diagrams, graphs, tables and solutions all come
// across on first open. From then on the copy is independent — deleting a
// solution or scribbling rough work here never changes the master lesson note.
// Storage lives on the notebook row (`companion_json`), so the working copy
// follows the note across devices and never appears on the Lesson Notes shelf.

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { DocumentEditor } from "@/components/lessonnotes/DocumentEditor";
import type { PaperSize, PaperStyle } from "@/lib/lessonnotes/paperThemes";
import { useNotebook } from "@/hooks/useNotebook";
import { duplicateNoteDoc, isEmptyDoc } from "@/lib/smartboard/duplicateNote";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  notebookId?: string;
  editable: boolean;
  onReturn: () => void;
  palette: {
    chromeBg: string;
    chromeFg: string;
    chromeBorder: string;
    hoverBg: string;
  };
}

export const CompanionNoteBoard = ({ notebookId, editable, onReturn, palette }: Props) => {
  const { notebook, loading, saveCompanionJson } = useNotebook(notebookId);

  const [paperSize, setPaperSize] = useState<PaperSize>("a4");
  const [paperStyle, setPaperStyle] = useState<PaperStyle>("plain");
  const [zoom, setZoom] = useState(1);
  const [pageExtraMm, setPageExtraMm] = useState(0);
  const [resetOpen, setResetOpen] = useState(false);
  /** Bumped on re-copy so the editor remounts on the fresh duplicate. */
  const [copyEpoch, setCopyEpoch] = useState(0);

  useEffect(() => {
    if (!notebook) return;
    setPaperSize(((notebook.paper_size as PaperSize) || "a4"));
    setPaperStyle(((notebook.paper_style as PaperStyle) || "plain"));
  }, [notebook?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── First open: duplicate the lesson note into the working copy ───────
   * Guarded per notebook so it can never re-seed (and never overwrite the
   * teacher's rough work) after the initial copy. */
  const seededRef = useRef<string | null>(null);
  useEffect(() => {
    if (!notebook || !notebookId || loading) return;
    if (seededRef.current === notebook.id) return;
    if (!isEmptyDoc(notebook.companion_json)) {
      seededRef.current = notebook.id;
      return;
    }
    if (isEmptyDoc(notebook.document_json)) return; // nothing to copy yet
    seededRef.current = notebook.id;
    const copy = duplicateNoteDoc(notebook.document_json);
    if (copy) saveCompanionJson(copy);
  }, [notebook?.id, notebook?.companion_json, notebook?.document_json, notebookId, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  /* The editor is uncontrolled once mounted: feeding it a NEW documentJson
   * (which happens the moment the first duplicate is saved) makes ProseMirror
   * rebuild its DOM under React, producing "removeChild: node is not a child".
   * So we freeze the doc we hand it at mount time and only change it through an
   * explicit remount (copyEpoch). */
  const initialDocRef = useRef<unknown>(undefined);
  if (initialDocRef.current === undefined && notebook && !loading) {
    // Wait for the first duplicate to land before mounting the editor, so we
    // never mount empty and then swap the doc in.
    if (!isEmptyDoc(notebook.companion_json)) {
      initialDocRef.current = notebook.companion_json;
    } else if (isEmptyDoc(notebook.document_json)) {
      initialDocRef.current = null; // nothing to copy — start blank
    }
  }
  const docReady = initialDocRef.current !== undefined;

  const recopyFromMaster = async () => {
    if (!notebook) return;
    const copy = duplicateNoteDoc(notebook.document_json);
    if (!copy) return;
    await saveCompanionJson(copy);
    initialDocRef.current = copy;
    setCopyEpoch((n) => n + 1);
    setResetOpen(false);
  };

  return (
    <div className="companion-note-board flex h-full w-full flex-col" style={{ background: "#15132a" }}>
      {/* The ribbon is translucent + backdrop-blurred by design on the light
          Lesson Notes page. Over the dark board it made every heading look
          washed out, so inside the working copy it renders fully opaque. */}
      <style>{`
        .companion-note-board .lesson-ribbon-shell > div {
          background: hsl(var(--background)) !important;
          backdrop-filter: none !important;
          color: hsl(var(--foreground)) !important;
        }
      `}</style>

      <div
        className="flex items-center gap-2 border-b px-3 py-1.5"
        style={{ background: palette.chromeBg, color: palette.chromeFg, borderColor: palette.chromeBorder }}
      >
        <button
          onClick={onReturn}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-md px-2 py-1 text-[11px]"
          style={{ background: palette.hoverBg }}
          title="Back to the teaching board"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Teaching board
        </button>
        <span className="text-[11px] opacity-70 truncate">
          {notebook?.title ? `${notebook.title} · working copy` : "Working copy"}
        </span>

        {editable && (
          <button
            onClick={() => setResetOpen(true)}
            className="ml-auto inline-flex min-h-[36px] items-center gap-1 rounded-md border px-2 py-1 text-[11px]"
            style={{ color: palette.chromeFg, borderColor: palette.chromeBorder }}
            title="Discard this working copy and duplicate the lesson note again"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Copy again from lesson note</span>
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1">
        {loading || !notebookId || !docReady ? (
          <div className="grid h-full place-items-center text-[12px] text-white/60">
            Opening your working copy…
          </div>
        ) : (
          <DocumentEditor
            key={`companion-${notebookId}-${copyEpoch}`}
            notebookId={notebookId}
            scopeSuffix="companion"
            documentJson={(initialDocRef.current as any) ?? null}
            hideSessionControls
            paperSize={paperSize}
            paperStyle={paperStyle}
            zoom={zoom}
            onZoomChange={setZoom}
            onPaperSizeChange={setPaperSize}
            onPaperStyleChange={setPaperStyle}
            onDocChange={(doc) => { if (editable) saveCompanionJson(doc); }}
            pageExtraMm={pageExtraMm}
            onPageExtraMmChange={setPageExtraMm}
            notebookContext={{
              subject: notebook?.subject,
              topic: notebook?.title ?? "",
              subtopic: notebook?.subtopic ?? "",
            }}
            exportFileName={`${notebook?.title || "lesson-notes"}-working-copy`}
          />
        )}
      </div>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Copy again from the lesson note?</AlertDialogTitle>
            <AlertDialogDescription>
              This replaces everything on your working copy with a fresh duplicate of the
              lesson note. Your rough work here will be lost. The lesson note itself is
              not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my working copy</AlertDialogCancel>
            <AlertDialogAction onClick={recopyFromMaster}>Copy again</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CompanionNoteBoard;

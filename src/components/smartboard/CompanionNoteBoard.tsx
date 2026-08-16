// CompanionNoteBoard — the Smartboard's second workspace.
//
// It is NOT a special board with its own tool system. It is another instance of
// the existing Lesson Note editor, blank until used, belonging privately to the
// lesson note currently on the board. Content is stored on the notebook row
// (`companion_json`), so it follows the note across devices and never appears in
// the teacher's Lesson Notes shelf.

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { DocumentEditor } from "@/components/lessonnotes/DocumentEditor";
import type { PaperSize, PaperStyle } from "@/lib/lessonnotes/paperThemes";
import { useNotebook } from "@/hooks/useNotebook";

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

  useEffect(() => {
    if (!notebook) return;
    setPaperSize(((notebook.paper_size as PaperSize) || "a4"));
    setPaperStyle(((notebook.paper_style as PaperStyle) || "plain"));
  }, [notebook?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="companion-note-board flex h-full w-full flex-col" style={{ background: "#15132a" }}>
      {/* The ribbon is translucent + backdrop-blurred by design on the light
          Lesson Notes page. Over the dark board it made every heading look
          washed out, so inside the companion it renders fully opaque. */}
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
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px]"
          style={{ background: palette.hoverBg }}
          title="Back to the writing workspace"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Writing workspace
        </button>
        <span className="text-[11px] opacity-70 truncate">
          {notebook?.title ? `${notebook.title} · companion page` : "Companion page"}
        </span>
      </div>

      <div className="min-h-0 flex-1">
        {loading || !notebookId ? (
          <div className="grid h-full place-items-center text-[12px] text-white/60">
            Opening the companion page…
          </div>
        ) : (
          <DocumentEditor
            notebookId={notebookId}
            scopeSuffix="companion"
            documentJson={notebook?.companion_json ?? null}
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
            exportFileName={`${notebook?.title || "lesson-notes"}-companion`}
          />
        )}
      </div>
    </div>
  );
};

export default CompanionNoteBoard;

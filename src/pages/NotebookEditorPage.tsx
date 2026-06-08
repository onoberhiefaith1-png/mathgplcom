// Single Lesson Notes editor (Word-style document with AI assist).
// All notebooks now use one editor; legacy block layout has been retired.
// The notebook tables are still preserved in the DB for backwards-compatible
// data access by other tools (smartboard, floating numbers) — they're seeded
// from a one-time migration in useNotebook when a notebook is first opened.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Presentation, Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";

import { DocumentEditor } from "@/components/lessonnotes/DocumentEditor";
import type { PaperSize, PaperStyle } from "@/lib/lessonnotes/paperThemes";
import { useNotebook } from "@/hooks/useNotebook";
import { themeForIndex } from "@/lib/lessonnotes/themes";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const NotebookEditorPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    notebook, loading,
    saveDocumentJson, updatePaperSettings, saveZoom,
  } = useNotebook(id);

  // Zoom: local state primed from DB; debounced save back.
  const [zoom, setZoom] = useState<number>(1);
  useEffect(() => {
    if (notebook?.zoom && Number.isFinite(notebook.zoom)) {
      setZoom(notebook.zoom);
    }
  }, [notebook?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const zoomTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleZoomChange = (z: number) => {
    setZoom(z);
    if (zoomTimer.current) clearTimeout(zoomTimer.current);
    zoomTimer.current = setTimeout(() => saveZoom(z), 400);
  };

  // QR scan-from-phone (still supported via dialog).
  const scanCode = useMemo(
    () => (id ? `${id.slice(0, 8)}-${Math.random().toString(36).slice(2, 8)}` : ""),
    [id],
  );
  const scanUrl = typeof window !== "undefined" ? `${window.location.origin}/notebook-scan/${scanCode}` : "";
  const [qrOpen, setQrOpen] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);

  const handleScanImage = useCallback(async (dataUrl: string) => {
    setScanBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("notebook-ai", {
        body: { mode: "scan", imageDataUrl: dataUrl },
      });
      if (error) throw error;
      const items: string[] = (data as any)?.items ?? [];
      if (!items.length) {
        toast({ title: "No problems detected", description: "Try a clearer photo." });
        return;
      }
      toast({ title: `Read ${items.length} problem(s)`, description: "Paste into a section in the document." });
    } catch (e: any) {
      toast({ title: "Scan failed", description: String(e?.message ?? e), variant: "destructive" });
    } finally {
      setScanBusy(false);
      setQrOpen(false);
    }
  }, []);

  useEffect(() => {
    if (!scanCode) return;
    const ch = supabase.channel(`notebook-scan-${scanCode}`, { config: { broadcast: { ack: true } } });
    ch.on("broadcast", { event: "image" }, (msg: any) => {
      const dataUrl = msg?.payload?.dataUrl;
      if (typeof dataUrl === "string") {
        toast({ title: "Photo received from phone", description: "Reading mathematics…" });
        handleScanImage(dataUrl);
      }
    });
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [scanCode, handleScanImage]);

  if (loading) {
    return (
      <main className="min-h-screen bg-background text-foreground grid place-items-center">
        <p className="text-sm text-muted-foreground">Loading notebook…</p>
      </main>
    );
  }
  if (!notebook) {
    return (
      <main className="min-h-screen bg-background text-foreground grid place-items-center">
        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">Notebook not found.</p>
          <Button onClick={() => navigate("/lesson-notes")}>Back to shelf</Button>
        </div>
      </main>
    );
  }

  const theme = themeForIndex(notebook.color_index);

  return (
    <main className="min-h-screen text-foreground flex flex-col" style={{ background: "#15132a" }}>
      <header
        className="sticky top-0 z-30 backdrop-blur-md border-b border-foreground/10"
        style={{ background: "rgba(21,19,42,0.85)" }}
      >
        <div className="mx-auto max-w-7xl px-4 py-2.5 flex items-center gap-3">
          <Button
            variant="ghost" size="sm"
            onClick={() => navigate("/lesson-notes")}
            className="gap-1.5 -ml-2 h-8 text-foreground/70 hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Shelf
          </Button>
          <div className="flex-1 min-w-0 text-center">
            <p className="text-[9px] uppercase tracking-[0.4em] text-foreground/40 truncate">
              {notebook.subject}
              {notebook.title ? ` · ${notebook.title}` : ""}
              {notebook.subtopic ? ` · ${notebook.subtopic}` : ""}
            </p>
            <h1 className="text-sm font-medium truncate text-foreground/90">
              {notebook.title || "Untitled notebook"}
            </h1>
          </div>
          <Button
            size="sm" variant="ghost"
            className="gap-1.5 h-8 text-foreground/70 hover:text-foreground"
            onClick={() => navigate(`/smartboard/${notebook.id}`)}
          >
            <Presentation className="h-3.5 w-3.5" /> Present
          </Button>
        </div>
        <div className="h-0.5 w-full" style={{ background: theme.gradient }} aria-hidden />
      </header>

      <div className="flex-1 min-h-0">
        <DocumentEditor
          documentJson={notebook.document_json}
          paperSize={(notebook.paper_size as PaperSize) || "a4"}
          paperStyle={(notebook.paper_style as PaperStyle) || "plain"}
          zoom={zoom}
          onZoomChange={handleZoomChange}
          onPaperSizeChange={(s) => updatePaperSettings({ paper_size: s })}
          onPaperStyleChange={(s) => updatePaperSettings({ paper_style: s })}
          onDocChange={saveDocumentJson}
          notebookContext={{
            subject: notebook.subject,
            topic: notebook.title ?? "",
            subtopic: notebook.subtopic ?? "",
          }}
          onPresent={() => navigate(`/smartboard/${notebook.id}`)}
          onScanFromPhone={() => setQrOpen(true)}
          exportFileName={notebook.title || notebook.subtopic || "lesson-notes"}
        />
      </div>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" /> Scan from your phone
            </DialogTitle>
            <DialogDescription>
              Point your phone at this QR code, then take a photo of the textbook page.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="rounded-lg bg-white p-4">
              <QRCodeSVG value={scanUrl} size={200} level="M" />
            </div>
            <p className="text-[11px] text-muted-foreground break-all text-center">{scanUrl}</p>
            {scanBusy && (
              <p className="text-xs text-muted-foreground inline-flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Reading the photo…
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default NotebookEditorPage;

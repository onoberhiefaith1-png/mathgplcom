// Single Lesson Notes editor (Word-style document with AI assist).
// All notebooks now use one editor; legacy block layout has been retired.
// The notebook tables are still preserved in the DB for backwards-compatible
// data access by other tools (smartboard, floating numbers) — they're seeded
// from a one-time migration in useNotebook when a notebook is first opened.

import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "@/lib/router-compat";
import { ArrowLeft, Presentation, Loader2, Smartphone, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";

// The editor carries the whole authoring surface (math, geometry, 3D, assets),
// so it downloads as its own chunk in parallel with the notebook query instead
// of blocking the page from appearing.
const DocumentEditor = lazy(() =>
  import("@/components/lessonnotes/DocumentEditor").then((m) => ({ default: m.DocumentEditor })),
);
import type { PaperSize, PaperStyle } from "@/lib/lessonnotes/paperThemes";
import { useNotebook } from "@/hooks/useNotebook";
import { themeForIndex } from "@/lib/lessonnotes/themes";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { saveBackToClass } from "@/lib/lessonnotes/notebookCopy";
import { useViewAs } from "@/lib/accounts/viewAs";
import type { CoPilotBridge } from "@/lib/lessonnotes/copilot/actions";
import { useLessonAiMode, setLessonAiMode } from "@/lib/lessonnotes/aiMode";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, ChevronDown } from "lucide-react";
import FeatureBoundary from "@/components/common/FeatureBoundary";
import SaveStatusPill from "@/components/common/SaveStatusPill";
import { readPendingLocalDraft, clearLocalDraft } from "@/lib/lessonnotes/localDraft";

// The Co-Pilot is closed by default and only downloads when opened.
const CoPilotPanel = lazy(() =>
  import("@/components/lessonnotes/copilot/CoPilotPanel").then((m) => ({ default: m.CoPilotPanel })),
);

const NotebookEditorPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  // The same editor, frozen, when a school looks through a teacher's shelf.
  const { viewOnly, allowEdit } = useViewAs();
  const {
    notebook, loading, saveState,
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
    if (viewOnly) return;
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
  // Class storage checkout: this working copy was pulled out of a class and
  // Save must replace the stored version.
  const checkoutLinkId = (notebook as { checkout_link_id?: string | null } | null)?.checkout_link_id ?? null;
  const [savingBack, setSavingBack] = useState(false);
  const saveToClass = async () => {
    if (!id || !checkoutLinkId) return;
    if (!allowEdit()) return;
    setSavingBack(true);
    try {
      await saveBackToClass(id, checkoutLinkId);
      toast({ title: "Class copy updated", description: "The stored notebook now matches this version." });
    } catch (e) {
      toast({ title: "Save to class failed", description: String((e as Error)?.message ?? e), variant: "destructive" });
    } finally {
      setSavingBack(false);
    }
  };
  const [scanBusy, setScanBusy] = useState(false);

  // Work that never reached the server (dropped connection, expired session) is
  // kept on this device and offered back instead of being silently lost.
  const [recovery, setRecovery] = useState<unknown | null>(null);
  useEffect(() => {
    if (!id || viewOnly) return;
    const pending = readPendingLocalDraft(id);
    if (pending) setRecovery(pending.doc);
  }, [id, viewOnly]);


  // Which AI owns this workspace. Co-Pilot mode docks the panel at ~1/3 of the
  // screen and hides every per-section AI control; Builder keeps them.
  const aiMode = useLessonAiMode();
  const copilotOpen = aiMode === "copilot";
  const copilotBridgeRef = useRef<CoPilotBridge | null>(null);

  // The lesson toolbar is fixed to the viewport, so it must know exactly how
  // tall this header really is — otherwise it hides behind it whenever the
  // header grows (narrow window, recovery banner, longer title).
  const [headerEl, setHeaderEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const root = document.documentElement;
    if (!headerEl) {
      root.style.removeProperty("--lesson-header-h");
      return;
    }
    const measure = () => {
      const h = Math.round(headerEl.getBoundingClientRect().height);
      if (h > 0) root.style.setProperty("--lesson-header-h", `${h}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(headerEl);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      root.style.removeProperty("--lesson-header-h");
    };
  }, [headerEl]);

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
    <main className="h-[100dvh] overflow-hidden text-foreground flex flex-col" style={{ background: "#15132a" }}>
      <header
        className="shrink-0 z-30 backdrop-blur-md border-b border-foreground/10"
        style={{ background: "rgba(21,19,42,0.85)" }}
      >
        <div className="mx-auto max-w-7xl px-2 sm:px-4 py-2.5 flex items-center gap-1.5 sm:gap-3 overflow-hidden">
          <Button
            variant="ghost" size="sm"
            onClick={() => navigate("/lesson-notes")}
            className="shrink-0 gap-1.5 -ml-1 sm:-ml-2 h-8 px-2 text-foreground/70 hover:text-foreground"
            title="Back to shelf"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> <span className="hidden lg:inline">Shelf</span>
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
          {checkoutLinkId && (
            <Button
              size="sm"
              onClick={saveToClass}
              disabled={savingBack}
              className="shrink-0 h-8 px-2 gap-1.5 bg-amber-400 text-amber-950 hover:bg-amber-300"
              title="Save to class"
            >
              {savingBack ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              <span className="hidden lg:inline">Save to class</span>
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant={copilotOpen ? "default" : "ghost"}
                className={`shrink-0 gap-1.5 h-8 px-2 ${copilotOpen ? "bg-amber-400 text-amber-950 hover:bg-amber-300" : "text-foreground/70 hover:text-foreground"}`}
                title={copilotOpen ? "MathGPL Co-Pilot active" : "MathGPL Math Engine active"}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">
                  {copilotOpen ? "MathGPL Co-Pilot" : "MathGPL Math Engine"}
                </span>
                <ChevronDown className="h-3 w-3 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuItem onClick={() => setLessonAiMode("copilot")} className="gap-2">
                <Check className={`h-3.5 w-3.5 ${copilotOpen ? "opacity-100" : "opacity-0"}`} />
                <span>
                  <span className="block text-sm">MathGPL Co-Pilot{copilotOpen ? " — Active" : ""}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    Understands the lesson: structure, workflow, editing
                  </span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLessonAiMode("mathengine")} className="gap-2">
                <Check className={`h-3.5 w-3.5 ${copilotOpen ? "opacity-0" : "opacity-100"}`} />
                <span>
                  <span className="block text-sm">MathGPL Math Engine{copilotOpen ? "" : " — Active"}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    Section tools, each one verified by the Engine
                  </span>
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="sm" variant="ghost"
            className="shrink-0 gap-1.5 h-8 px-2 text-foreground/70 hover:text-foreground"
            onClick={() => navigate(`/smartboard/${notebook.id}`)}
            title="Present"
          >
            <Presentation className="h-3.5 w-3.5" /> <span className="hidden lg:inline">Present</span>
          </Button>
        </div>

        <div className="flex items-center gap-2 px-3 pb-1">
          <p className="text-[10px] text-foreground/50 truncate">
            {copilotOpen
              ? "MathGPL Co-Pilot — Active. Section AI markers are hidden; Solution, Diagram, Tables, Graph, Assign and Floating work as normal editing tools."
              : "MathGPL Math Engine — Active. Section tools are available, and every one of them is verified by the Engine."}
          </p>
          <SaveStatusPill state={viewOnly ? "idle" : saveState} className="ml-auto shrink-0" />
        </div>
        {recovery != null && (
          <div className="mx-3 mb-2 flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <span className="flex-1">
              This device has changes from your last session that never finished saving.
            </span>
            <Button
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => {
                const doc = recovery;
                setRecovery(null);
                if (doc) saveDocumentJson(doc);
              }}
            >
              Restore them
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => {
                if (id) clearLocalDraft(id);
                setRecovery(null);
              }}
            >
              Discard
            </Button>
          </div>
        )}


        <div className="h-0.5 w-full" style={{ background: theme.gradient }} aria-hidden />
      </header>

      <div className="flex-1 min-h-0 overflow-hidden flex">
        <div className="flex-1 min-w-0 h-full overflow-hidden">
        <Suspense
          fallback={
            <div className="h-full grid place-items-center">
              <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Opening the lesson note…
              </p>
            </div>
          }
        >
        <DocumentEditor
          documentJson={notebook.document_json}
          paperSize={(notebook.paper_size as PaperSize) || "a4"}
          paperStyle={(notebook.paper_style as PaperStyle) || "plain"}
          zoom={zoom}
          onZoomChange={handleZoomChange}
          onPaperSizeChange={(s) => { if (allowEdit()) updatePaperSettings({ paper_size: s }); }}
          onPaperStyleChange={(s) => { if (allowEdit()) updatePaperSettings({ paper_style: s }); }}
          onDocChange={(doc) => { if (!viewOnly) saveDocumentJson(doc); }}
          pageExtraMm={(notebook as { page_extra_mm?: number }).page_extra_mm ?? 0}
          onPageExtraMmChange={(mm) => { if (allowEdit()) updatePaperSettings({ page_extra_mm: mm }); }}
          notebookContext={{
            subject: notebook.subject,
            topic: notebook.title ?? "",
            subtopic: notebook.subtopic ?? "",
          }}
          onPresent={() => navigate(`/smartboard/${notebook.id}`)}
          onScanFromPhone={() => setQrOpen(true)}
          exportFileName={notebook.title || notebook.subtopic || "lesson-notes"}
          gameQuestionsOnly={(notebook as { purpose?: string }).purpose === "game"}
          copilotBridgeRef={copilotBridgeRef}
        />
        </Suspense>
        </div>
        {copilotOpen && (
          <>
            {/* Narrow screens only: dimmed backdrop behind the slide-over */}
            <button
              type="button"
              aria-label="Close Co-Pilot"
              className="md:hidden fixed inset-0 z-40 bg-black/50"
              onClick={() => setLessonAiMode("mathengine")}
            />
            {/* ONE Co-Pilot instance: docked on wide screens, slide-over on narrow */}
            <div className="fixed inset-y-0 right-0 z-40 w-[88%] max-w-[420px] shadow-2xl md:static md:inset-auto md:z-auto md:h-full md:w-[34%] md:min-w-[320px] md:max-w-[520px] md:shadow-none">
              {/* A Co-Pilot failure must never blank the lesson note. */}
              <FeatureBoundary feature="MathGPL Co-Pilot">
                <Suspense fallback={<div className="h-full border-l border-foreground/10 bg-background" />}>
                  <CoPilotPanel bridgeRef={copilotBridgeRef} notebookId={id} onClose={() => setLessonAiMode("mathengine")} />
                </Suspense>
              </FeatureBoundary>
            </div>

          </>
        )}


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

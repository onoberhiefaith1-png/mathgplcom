// Single Lesson Notes editor (Word-style document with AI assist).
// All notebooks now use one editor; legacy block layout has been retired.
// The notebook tables are still preserved in the DB for backwards-compatible
// data access by other tools (smartboard, floating numbers) — they're seeded
// from a one-time migration in useNotebook when a notebook is first opened.

import { registerTutorAction } from "@/lib/assistant/actions";
import FlowToggle from "@/components/flow/FlowToggle";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "@/lib/router-compat";
import { ArrowLeft, Presentation, Loader2, Smartphone, Save, Sparkles, Wand2, ListTree, Plus } from "lucide-react";
import { SubtopicDrawer } from "@/components/lessonnotes/SubtopicDrawer";
import {
  type Subtopic, listSubtopics, createSubtopic, updateSubtopic, deleteSubtopic,
  setActiveSubtopic, nextOrderIndex, moveSubtopic, activeAfterDelete, docHasContent,
} from "@/lib/lessonnotes/subtopics";
import {
  applySubtopicDocument, cloneDoc, docsEqual, emptyDoc, planInstantSwitch,
  resolveOpenSubtopic, shouldRestoreDraft, storedDocumentFor,
} from "@/lib/lessonnotes/subtopicDocuments";
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
import {
  useLessonAiMode, setLessonAiMode,
  LESSON_MODE_LABELS, LESSON_MODE_NOTES,
} from "@/lib/lessonnotes/aiMode";
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
      await flushLessonNote();
      await saveBackToClass(id, checkoutLinkId);
      toast({ title: "Class copy updated", description: "The stored notebook now matches this version." });
    } catch (e) {
      toast({ title: "Save to class failed", description: String((e as Error)?.message ?? e), variant: "destructive" });
    } finally {
      setSavingBack(false);
    }
  };
  const [scanBusy, setScanBusy] = useState(false);
  const [forcingSave, setForcingSave] = useState(false);

  // Newest document the editor handed over, so a flush followed straight away
  // by a subtopic switch saves the fresh text rather than a stale copy.
  const latestDocRef = useRef<unknown>(null);
  // Seed once from the loaded notebook. Never write it back over a newer editor snapshot.
  useEffect(() => {
    if (latestDocRef.current == null && notebook?.document_json != null) {
      latestDocRef.current = notebook.document_json;
    }
  }, [notebook?.document_json]);

  const flushLessonNote = useCallback((opts?: { ownerId?: string | null }) => new Promise<void>((resolve, reject) => {
    let handled = false;
    const ownerId = opts?.ownerId ?? activeIdRef.current;
    const detail: { claimed?: boolean; json?: unknown; done: (error?: unknown) => void } = {
        done: (error?: unknown) => {
          handled = true;
          if (error) reject(error);
          else resolve();
        },
    };
    window.dispatchEvent(new CustomEvent("mathgpl:flush-lesson-note", { detail }));
    if (detail.json !== undefined) latestDocRef.current = detail.json;
    // The editor can still be loading; saving the already-loaded document is a
    // safe fallback rather than leaving the button hanging.
    window.setTimeout(() => {
      // The live editor claimed the flush: it saves the fresh document itself,
      // so never write the older stored copy over it.
      if (handled || detail.claimed) return;
      if (ownerId && ownerId !== activeIdRef.current) { resolve(); return; }
      Promise.resolve(saveDocumentJson(notebook?.document_json, { ownerId, liveOwnerId: activeIdRef.current })).then(resolve).catch(reject);
    }, 100);
  }), [notebook?.document_json, saveDocumentJson]);

  /** Read the editor's current JSON in this tick, without waiting for a save. */
  const peekLessonNote = useCallback(() => {
    const detail: { claimed?: boolean; json?: unknown } = {};
    window.dispatchEvent(new CustomEvent("mathgpl:flush-lesson-note", { detail }));
    if (detail.json !== undefined) latestDocRef.current = detail.json;
    return latestDocRef.current;
  }, []);

  const forceSave = useCallback(async () => {
    if (viewOnly || forcingSave) return;
    setForcingSave(true);
    try {
      await flushLessonNote();
      toast({ title: "Lesson note saved" });
    } catch (error) {
      toast({ title: "Save failed", description: String((error as Error)?.message ?? error), variant: "destructive" });
    } finally {
      setForcingSave(false);
    }
  }, [flushLessonNote, forcingSave, viewOnly]);

  const presentLesson = useCallback(async () => {
    try { await flushLessonNote(); } catch { /* save status already reports failure */ }
    if (notebook?.id) navigate(`/smartboard/${notebook.id}?from=note`);
  }, [flushLessonNote, navigate, notebook?.id]);

  // Work that never reached the server (dropped connection, expired session) is
  // kept on this device and offered back instead of being silently lost.
  const [recovery, setRecovery] = useState<unknown | null>(null);
  const recoveryForRef = useRef<string | null>(null);


  // Which AI owns this workspace. Co-Pilot mode docks the panel at ~1/3 of the
  // screen and hides every per-section AI control; Builder keeps them.
  const aiMode = useLessonAiMode();
  const copilotOpen = aiMode === "copilot";
  const copilotBridgeRef = useRef<CoPilotBridge | null>(null);
  useEffect(() => registerTutorAction("copilot.open", () => {
    setLessonAiMode("copilot");
    return { ok: true };
  }), []);

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

  // ---- Subtopics inside this Topic note ----
  const [subtopics, setSubtopics] = useState<Subtopic[]>([]);
  const subtopicsRef = useRef<Subtopic[]>([]);
  useEffect(() => { subtopicsRef.current = subtopics; }, [subtopics]);
  const [activeSubtopicId, setActiveSubtopicId] = useState<string | null>(null);
  const [openDoc, setOpenDoc] = useState<unknown>(null);
  const activeIdRef = useRef<string | null>(null);
  const switchChain = useRef(Promise.resolve());
  const [subtopicsLoaded, setSubtopicsLoaded] = useState(false);
  // Content the editor already holds, including an Accept that has not been
  // echoed into notebook.document_json yet. The empty-subtopic gate must not
  // unmount that editor.
  const [draftNotebookId, setDraftNotebookId] = useState(id);
  const [draftHasContent, setDraftHasContent] = useState(false);
  if (draftNotebookId !== id) {
    setDraftNotebookId(id);
    setDraftHasContent(false);
  }
  const [drawerOpen, setDrawerOpen] = useState(true);
  // The fixed lesson ribbon overlays the top of the content row; push the
  // subtopic bar below it so its Topic, + and X are never hidden.
  const drawerRowRef = useRef<HTMLDivElement | null>(null);
  const [ribbonOffset, setRibbonOffset] = useState(0);
  useEffect(() => {
    const measure = () => {
      const row = drawerRowRef.current;
      const ribbon = document.querySelector(".lesson-ribbon-shell");
      if (!row || !ribbon) { setRibbonOffset(0); return; }
      const off = Math.round(ribbon.getBoundingClientRect().bottom - row.getBoundingClientRect().top);
      setRibbonOffset(Math.max(0, off));
    };
    measure();
    const t = window.setInterval(measure, 500);
    window.addEventListener("resize", measure);
    return () => { window.clearInterval(t); window.removeEventListener("resize", measure); };
  }, []);
  useEffect(() => {
    if (!notebook?.id) return;
    let alive = true;
    const saved = (notebook as { active_subtopic_id?: string | null }).active_subtopic_id ?? null;
    listSubtopics(notebook.id).then(async (list) => {
      if (!alive) return;
      const open = resolveOpenSubtopic(list, saved, notebook.document_json);
      let nextList = list;
      if (!viewOnly && open.writeNotebookToActive && open.activeId) {
        // Persist the live notebook page onto that one subtopic only.
        await updateSubtopic(open.activeId, { document_json: open.doc });
        nextList = applySubtopicDocument(list, open.activeId, open.doc);
      }
      if (!alive) return;
      setSubtopics(nextList);
      setActiveSubtopicId(open.activeId);
      setOpenDoc(open.doc);
      activeIdRef.current = open.activeId;
      latestDocRef.current = open.doc;
      // The open page must belong to the chosen subtopic, not sit under the first name.
      if (open.activeId && !docsEqual(open.doc, notebook.document_json)) {
        if (viewOnly) notebook.document_json = open.doc;
        else await saveDocumentJson(open.doc, { ownerId: open.activeId, liveOwnerId: open.activeId });
      }
      setSubtopicsLoaded(true);
    }).catch(() => { if (alive) setSubtopicsLoaded(true); });
    return () => { alive = false; };
  }, [notebook?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // The subtopic whose page is on screen right now; set the instant a switch
  // begins so late saves from the page being left are dropped.
  useEffect(() => { activeIdRef.current = activeSubtopicId; }, [activeSubtopicId]);
  useEffect(() => {
    if (!id || viewOnly || !subtopicsLoaded) return;
    const openId = activeIdRef.current;
    const pending = readPendingLocalDraft(id, openId);
    if (pending && shouldRestoreDraft(pending, openId)) {
      recoveryForRef.current = pending.subtopicId ?? openId;
      setRecovery(pending.doc);
    } else {
      setRecovery(null);
    }
  }, [id, viewOnly, subtopicsLoaded]);
  const activeSubtopic = subtopics.find((s) => s.id === activeSubtopicId) ?? null;
  const waitingForSubtopic = subtopicsLoaded && subtopics.length === 0
    && !draftHasContent
    && !docHasContent(notebook?.document_json);

  const switchSubtopic = useCallback((targetId: string) => {
    if (!notebook) return;
    const fromId = activeIdRef.current;
    const target = subtopicsRef.current.find((s) => s.id === targetId);
    if (!target) return;
    const fromDoc = peekLessonNote() ?? latestDocRef.current ?? notebook.document_json;
    const planned = planInstantSwitch({
      fromId, fromDoc, targetId, targetDoc: target.document_json,
    });
    // The first click must change the page in this tick. Network save follows.
    activeIdRef.current = planned.displayId;
    latestDocRef.current = planned.displayDoc;
    setActiveSubtopicId(planned.displayId);
    setOpenDoc(planned.displayDoc);
    if (viewOnly) {
      notebook.document_json = planned.displayDoc;
      return;
    }
    void setActiveSubtopic(notebook.id, target);
    const persist = planned.persistFrom;
    if (!persist) return;
    setSubtopics((list) => {
      const next = applySubtopicDocument(list, persist.id, persist.doc);
      subtopicsRef.current = next;
      return next;
    });
    const run = async () => {
      try {
        await updateSubtopic(persist.id, { document_json: persist.doc });
        // Never write the left-behind lesson onto the live notebook if the
        // teacher has already opened a different subtopic.
        await saveDocumentJson(persist.doc, { ownerId: persist.id, liveOwnerId: activeIdRef.current, syncBoard: false });
        if (activeIdRef.current === planned.displayId) {
          void saveDocumentJson(planned.displayDoc, { ownerId: planned.displayId, liveOwnerId: planned.displayId });
        }
      } catch (e: any) {
        toast({ title: "Could not save the previous subtopic", description: String(e?.message ?? e), variant: "destructive" });
      }
    };
    const p = switchChain.current.then(run, run);
    switchChain.current = p.then(() => undefined, () => undefined);
  }, [notebook, viewOnly, saveDocumentJson, peekLessonNote]);

  const addSubtopic = useCallback((name: string) => {
    const run = async () => {
      if (!notebook || !allowEdit()) return;
      try {
        const fromId = activeIdRef.current;
        const fromDoc = peekLessonNote() ?? latestDocRef.current ?? notebook.document_json;
        const created = await createSubtopic(notebook.id, name, nextOrderIndex(subtopicsRef.current));
        if (subtopicsRef.current.length === 0) {
          // The first subtopic adopts whatever is already on the page.
          const adopted = cloneDoc(fromDoc ?? emptyDoc());
          setSubtopics([{ ...created, document_json: adopted }]);
          subtopicsRef.current = [{ ...created, document_json: adopted }];
          activeIdRef.current = created.id;
          setActiveSubtopicId(created.id);
          setOpenDoc(adopted);
          latestDocRef.current = adopted;
          void setActiveSubtopic(notebook.id, created);
          if (docHasContent(adopted)) void updateSubtopic(created.id, { document_json: adopted });
          if (!notebook.document_json) void saveDocumentJson(emptyDoc(), { ownerId: created.id, liveOwnerId: created.id });
        } else {
          const blank = emptyDoc();
          const nextList = applySubtopicDocument(
            [...subtopicsRef.current.filter((s) => s.id !== created.id), created],
            fromId, fromDoc,
          );
          subtopicsRef.current = nextList;
          setSubtopics(nextList);
          activeIdRef.current = created.id;
          setActiveSubtopicId(created.id);
          setOpenDoc(blank);
          latestDocRef.current = blank;
          void setActiveSubtopic(notebook.id, created);
          if (fromId) void updateSubtopic(fromId, { document_json: fromDoc });
          void updateSubtopic(created.id, { document_json: blank });
          if (fromId) void saveDocumentJson(fromDoc, { ownerId: fromId, liveOwnerId: created.id, syncBoard: false });
          void saveDocumentJson(blank, { ownerId: created.id, liveOwnerId: created.id });
        }
      } catch (e: any) {
        toast({ title: "Could not add subtopic", description: String(e?.message ?? e), variant: "destructive" });
      }
    };
    const p = switchChain.current.then(run, run);
    switchChain.current = p.then(() => undefined, () => undefined);
    return p;
  }, [notebook, allowEdit, saveDocumentJson, peekLessonNote]);

  const renameSubtopic = useCallback(async (sid: string, name: string) => {
    if (!notebook || !allowEdit()) return;
    await updateSubtopic(sid, { name });
    setSubtopics((l) => l.map((s) => (s.id === sid ? { ...s, name } : s)));
    if (sid === activeSubtopicId) await setActiveSubtopic(notebook.id, { id: sid, name });
  }, [notebook, activeSubtopicId, allowEdit]);

  const reorderSubtopic = useCallback(async (sid: string, dir: -1 | 1) => {
    if (!allowEdit()) return;
    const next = moveSubtopic(subtopics, sid, dir);
    setSubtopics(next);
    await Promise.all(next.map((s) => updateSubtopic(s.id, { order_index: s.order_index })));
  }, [subtopics, allowEdit]);

  const removeSubtopic = useCallback(async (sid: string) => {
    if (!notebook || !allowEdit()) return;
    const nextActive = activeAfterDelete(subtopics, sid, activeSubtopicId);
    try {
      await deleteSubtopic(sid);
      const rest = subtopics.filter((s) => s.id !== sid);
      setSubtopics(rest);
      if (sid === activeSubtopicId) {
        const target = rest.find((s) => s.id === nextActive) ?? null;
        const nextDoc = storedDocumentFor(target);
        activeIdRef.current = target?.id ?? null;
        setActiveSubtopicId(target?.id ?? null);
        setOpenDoc(nextDoc);
        latestDocRef.current = nextDoc;
        void setActiveSubtopic(notebook.id, target);
        void saveDocumentJson(nextDoc, { ownerId: target?.id, liveOwnerId: target?.id });
      }
    } catch (e: any) {
      toast({ title: "Could not delete subtopic", description: String(e?.message ?? e), variant: "destructive" });
    }
  }, [notebook, subtopics, activeSubtopicId, allowEdit, saveDocumentJson]);

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
        ref={setHeaderEl}
        className="shrink-0 z-30 backdrop-blur-md border-b border-foreground/10"
        style={{ background: "rgba(21,19,42,0.85)" }}
      >
        <div className="mx-auto max-w-7xl px-2 sm:px-4 py-1.5 sm:py-2.5 flex items-center gap-1.5 sm:gap-3 overflow-hidden">
          <Button
            variant="ghost" size="sm"
            onClick={async () => { try { await flushLessonNote(); } finally { navigate("/lesson-notes"); } }}
            className="shrink-0 gap-1.5 -ml-1 sm:-ml-2 h-8 px-2 text-foreground/70 hover:text-foreground"
            title="Back to shelf"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> <span className="hidden lg:inline">Shelf</span>
          </Button>
          <div className="flex-1 min-w-0 text-center">
            <p className="text-[9px] uppercase tracking-[0.4em] text-foreground/40 truncate">
              {notebook.subject}
              {notebook.title ? ` · ${notebook.title}` : ""}
              {activeSubtopic ? ` · ${activeSubtopic.name}` : ""}
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
          {!viewOnly && (
            <Button
              size="sm" variant="ghost"
              className="shrink-0 gap-1.5 h-8 px-2 text-foreground/70 hover:text-foreground"
              onClick={() => window.dispatchEvent(new CustomEvent("mathgpl:open-ai-edit"))}
              title="AI Edit — paste or type content, AI structures it, Accept inserts it"
            >
              <Wand2 className="h-3.5 w-3.5" /> <span className="hidden lg:inline">AI Edit</span>
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant={aiMode === "manual" ? "ghost" : "default"}
                className={`shrink-0 gap-1.5 h-8 px-2 ${aiMode === "manual" ? "text-foreground/70 hover:text-foreground" : "bg-amber-400 text-amber-950 hover:bg-amber-300"}`}
                title={LESSON_MODE_NOTES[aiMode]}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">{LESSON_MODE_LABELS[aiMode]}</span>
                <ChevronDown className="h-3 w-3 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuItem onClick={() => setLessonAiMode("manual")} className="gap-2">
                <Check className={`h-3.5 w-3.5 ${aiMode === "manual" ? "opacity-100" : "opacity-0"}`} />
                <span>
                  <span className="block text-sm">Manual{aiMode === "manual" ? " — Active" : ""}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    You build the lesson. AI Edit structures what you bring.
                  </span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLessonAiMode("copilot")} className="gap-2">
                <Check className={`h-3.5 w-3.5 ${aiMode === "copilot" ? "opacity-100" : "opacity-0"}`} />
                <span>
                  <span className="block text-sm">MathGPL Co-Pilot{aiMode === "copilot" ? " — Active" : ""}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    Full lesson generation plus every section AI tool
                  </span>
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <FlowToggle notebookId={notebook.id} />
          <Button
            size="sm" variant="ghost"
            className="shrink-0 gap-1.5 h-8 px-2 text-foreground/70 hover:text-foreground"
            onClick={presentLesson}
            title="Present"
          >
            <Presentation className="h-3.5 w-3.5" /> <span className="hidden lg:inline">Present</span>
          </Button>
          {!viewOnly && (
            <Button
              size="sm" variant="ghost"
              className="shrink-0 gap-1.5 h-8 px-2 text-foreground/70 hover:text-foreground"
              onClick={forceSave}
              disabled={forcingSave}
              title="Save lesson note"
            >
              {forcingSave ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              <span className="hidden lg:inline">{forcingSave ? "Saving…" : "Save"}</span>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 px-3 pb-1">
          {/* On narrow windows the header stays a single compact row so it can
              never grow tall enough to swallow the lesson toolbar. */}
          <p className="hidden md:block text-[10px] text-foreground/50 truncate">
            {LESSON_MODE_NOTES[aiMode]}
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
                const owner = recoveryForRef.current ?? activeIdRef.current;
                setRecovery(null);
                if (!doc || (owner && owner !== activeIdRef.current)) return;
                setOpenDoc(doc);
                latestDocRef.current = doc;
                saveDocumentJson(doc, { ownerId: owner, liveOwnerId: activeIdRef.current });
                if (owner) void updateSubtopic(owner, { document_json: doc });
              }}
            >
              Restore them
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => {
                if (id) clearLocalDraft(id, activeIdRef.current);
                setRecovery(null);
              }}
            >
              Discard
            </Button>
          </div>
        )}


        <div className="h-0.5 w-full" style={{ background: theme.gradient }} aria-hidden />
      </header>

      <div ref={drawerRowRef} className="flex-1 min-h-0 overflow-hidden flex">
        {drawerOpen ? (
          <SubtopicDrawer
            topic={notebook.title ?? ""}
            subtopics={subtopics}
            activeId={activeSubtopicId}
            readOnly={viewOnly}
            topOffset={ribbonOffset}
            onClose={() => setDrawerOpen(false)}
            onSelect={switchSubtopic}
            onAdd={addSubtopic}
            onRename={renameSubtopic}
            onMove={reorderSubtopic}
            onDelete={removeSubtopic}
          />
        ) : (
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            style={{ paddingTop: ribbonOffset + 12 }}
            className="shrink-0 w-8 border-r border-border bg-card/80 text-muted-foreground hover:text-foreground flex flex-col items-center gap-2"
            aria-label="Open subtopics"
            title="Subtopics"
          >
            <ListTree className="h-4 w-4" />
            <span className="text-[10px] [writing-mode:vertical-rl]">Subtopics</span>
          </button>
        )}
        <div className="flex-1 min-w-0 h-full overflow-hidden">
        {waitingForSubtopic ? (
          <div className="h-full grid place-items-center p-6 text-center">
            <div className="space-y-3">
              <p className="text-lg font-semibold">{notebook.title || "This topic"}</p>
              <p className="text-sm text-muted-foreground">Add a subtopic to begin. Co-Pilot starts once a subtopic is selected.</p>
              {!viewOnly && (
                <Button onClick={() => { setDrawerOpen(true); const n = window.prompt("Subtopic name"); if (n?.trim()) addSubtopic(n.trim()); }} className="gap-1.5">
                  <Plus className="h-4 w-4" /> Add subtopic
                </Button>
              )}
            </div>
          </div>
        ) : (
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
          key={activeSubtopicId ?? "topic"}
          documentJson={openDoc ?? notebook.document_json}
          paperSize={(notebook.paper_size as PaperSize) || "a4"}
          paperStyle={(notebook.paper_style as PaperStyle) || "plain"}
          zoom={zoom}
          onZoomChange={handleZoomChange}
          onPaperSizeChange={(s) => { if (allowEdit()) updatePaperSettings({ paper_size: s }); }}
          onPaperStyleChange={(s) => { if (allowEdit()) updatePaperSettings({ paper_style: s }); }}
          onDraftChange={setDraftHasContent}
          onDocChange={((owner) => (doc: unknown) => {
            // A save started on one subtopic's page must never land on another.
            if (viewOnly || owner !== activeIdRef.current) return;
            const snapshot = cloneDoc(doc);
            latestDocRef.current = snapshot;
            if (docHasContent(snapshot)) setDraftHasContent(true);
            setOpenDoc(snapshot);
            saveDocumentJson(snapshot as typeof notebook.document_json, { ownerId: owner, liveOwnerId: activeIdRef.current });
            // Keep this subtopic's own row in step with the open page, so a later
            // lesson cannot replace it when the notebook row is the only copy.
            if (owner && owner === activeIdRef.current) {
              void updateSubtopic(owner, { document_json: snapshot });
              setSubtopics((list) => {
                const next = applySubtopicDocument(list, owner, snapshot);
                subtopicsRef.current = next;
                return next;
              });
            }
          })(activeSubtopicId)}
          pageExtraMm={(notebook as { page_extra_mm?: number }).page_extra_mm ?? 0}
          onPageExtraMmChange={(mm) => { if (allowEdit()) updatePaperSettings({ page_extra_mm: mm }); }}
          notebookContext={{
            subject: notebook.subject,
            topic: notebook.title ?? "",
            subtopic: activeSubtopic?.name ?? notebook.subtopic ?? "",
            subtopicId: activeSubtopicId ?? undefined,
          }}
          onPresent={presentLesson}
          onScanFromPhone={() => setQrOpen(true)}
          exportFileName={[notebook.title, activeSubtopic?.name].filter(Boolean).join(" - ") || "lesson-notes"}
          gameQuestionsOnly={(notebook as { purpose?: string }).purpose === "game"}
          copilotBridgeRef={copilotBridgeRef}
        />
        </Suspense>
        )}
        </div>
        {copilotOpen && !waitingForSubtopic && (
          <>
            {/* Narrow screens only: dimmed backdrop behind the slide-over */}
            <button
              type="button"
              aria-label="Close Co-Pilot"
              className="md:hidden fixed inset-0 z-40 bg-black/50"
              onClick={() => setLessonAiMode("manual")}
            />
            {/* ONE Co-Pilot instance: docked on wide screens, slide-over on narrow */}
            <div className="fixed inset-y-0 right-0 z-40 w-[88%] max-w-[420px] shadow-2xl md:static md:inset-auto md:z-auto md:h-full md:w-[34%] md:min-w-[320px] md:max-w-[520px] md:shadow-none">
              {/* A Co-Pilot failure must never blank the lesson note. */}
              <FeatureBoundary feature="MathGPL Co-Pilot">
                <Suspense fallback={<div className="h-full border-l border-foreground/10 bg-background" />}>
                  <CoPilotPanel bridgeRef={copilotBridgeRef} notebookId={id} onClose={() => setLessonAiMode("manual")} />
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

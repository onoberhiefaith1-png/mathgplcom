import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { syncDocumentToNotebook } from "@/lib/lessonnotes/syncDocumentToNotebook";
import { repairDocumentMath } from "@/lib/lessonnotes/aiToNodes";
import { withTimeout } from "@/lib/async/withTimeout";

export type SectionKind =
  | "introduction"
  | "explanation"
  | "example"
  | "exercise"
  | "classwork"
  | "homework"
  | "summary";

export type BlockKind = "problem" | "solution" | "reasoning" | "text";

export interface NotebookRow {
  id: string;
  title: string | null;
  teacher: string;
  class_name: string;
  session: string;
  subject: string;
  subtopic: string;
  color_index: number;
  /** Word-style document body (ProseMirror JSON). When non-null, the editor renders document mode. */
  document_json: any | null;
  /** Private companion page belonging to this lesson note (ProseMirror JSON). */
  companion_json?: any | null;
  paper_style: string;
  paper_size: string;
  page_extra_mm?: number;
  zoom: number;
}


export interface BlockRow {
  id: string;
  section_id: string;
  subsection_id: string | null;
  kind: BlockKind;
  content_ascii: string;
  order_index: number;
}

export interface SubsectionRow {
  id: string;
  section_id: string;
  order_index: number;
  blocks: BlockRow[];
  /** Pre-decomposed floating fragments from Lesson Notes (per line). */
  floating_lines?: any[] | null;
  /** Compiled floating bucket (Master + View) from Lesson Notes. */
  floating_bucket?: any | null;
  /** Teacher highlight/notebook pairing metadata from Floating Prep. */
  floating_highlights?: any[] | null;
}

export interface SectionRow {
  id: string;
  notebook_id: string;
  kind: SectionKind;
  title: string | null;
  order_index: number;
  subsections: SubsectionRow[];
  // Intro/explanation/summary use loose "text" blocks (not subsections)
  loose: BlockRow[];
}

export const SECTION_LABEL: Record<SectionKind, string> = {
  introduction: "Introduction",
  explanation: "Explanation",
  example: "Example",
  exercise: "Exercise",
  classwork: "Classwork",
  homework: "Homework",
  summary: "Summary",
};

const NUMBERED_KINDS: SectionKind[] = ["example", "exercise", "classwork", "homework"];
export const isNumberedKind = (k: SectionKind) => NUMBERED_KINDS.includes(k);

// The on-open Lesson-Note → Smartboard sync DELETES and RECREATES the
// notebook_sections/subsections rows (new IDs every run). When two hook
// instances (Smartboard + Presenter Preview) each ran their own sync,
// they raced each other and each side ended up holding a DIFFERENT
// generation of section IDs — so the preview's items could never be
// found among the board's beats ("work / no work"). Share ONE sync per
// notebook per session and have every instance reload after it settles
// so all consumers converge on the same generation of IDs.
const onOpenSyncPromises = new Map<string, Promise<unknown>>();


export function useNotebook(notebookId: string | undefined) {
  const [notebook, setNotebook] = useState<NotebookRow | null>(null);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!notebookId) return;
    setLoading(true);
    const { data: nb, error: nbErr } = await supabase
      .from("notebooks")
      .select("*")
      .eq("id", notebookId)
      .maybeSingle();
    if (nbErr || !nb) {
      toast({ title: "Notebook not found", variant: "destructive" });
      setLoading(false);
      return;
    }
    setNotebook(nb as NotebookRow);

    const [{ data: secs }, { data: subs }, { data: blks }] = await Promise.all([
      supabase.from("notebook_sections").select("*").eq("notebook_id", notebookId).order("order_index"),
      supabase
        .from("notebook_subsections")
        .select("*, notebook_sections!inner(notebook_id)")
        .eq("notebook_sections.notebook_id", notebookId)
        .order("order_index"),
      supabase
        .from("notebook_blocks")
        .select("*, notebook_sections!inner(notebook_id)")
        .eq("notebook_sections.notebook_id", notebookId)
        .order("order_index"),
    ]);

    const subBySection = new Map<string, SubsectionRow[]>();
    (subs ?? []).forEach((s: any) => {
      const arr = subBySection.get(s.section_id) ?? [];
      arr.push({
        id: s.id,
        section_id: s.section_id,
        order_index: s.order_index,
        blocks: [],
        floating_lines: s.floating_lines ?? null,
        floating_bucket: s.floating_bucket ?? null,
        floating_highlights: s.floating_highlights ?? null,
      });
      subBySection.set(s.section_id, arr);
    });

    const blockBySub = new Map<string, BlockRow[]>();
    const looseBySection = new Map<string, BlockRow[]>();
    (blks ?? []).forEach((b: any) => {
      const row: BlockRow = {
        id: b.id,
        section_id: b.section_id,
        subsection_id: b.subsection_id,
        kind: b.kind,
        content_ascii: b.content_ascii ?? "",
        order_index: b.order_index,
      };
      if (b.subsection_id) {
        const arr = blockBySub.get(b.subsection_id) ?? [];
        arr.push(row);
        blockBySub.set(b.subsection_id, arr);
      } else {
        const arr = looseBySection.get(b.section_id) ?? [];
        arr.push(row);
        looseBySection.set(b.section_id, arr);
      }
    });

    const built: SectionRow[] = (secs ?? []).map((s: any) => ({
      id: s.id,
      notebook_id: s.notebook_id,
      kind: s.kind,
      title: s.title,
      order_index: s.order_index,
      loose: looseBySection.get(s.id) ?? [],
      subsections: (subBySection.get(s.id) ?? []).map((ss) => ({
        ...ss,
        blocks: blockBySub.get(ss.id) ?? [],
      })),
    }));
    setSections(built);
    setLoading(false);
  }, [notebookId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Auto-migrate any legacy notebook to document mode on open so there's
  // only one editor. Runs once per load, after sections have been built.
  // Also runs a one-time Lesson-Note → Smartboard sync so the legacy tables
  // the Smartboard reads from always match what's in the document.
  const migratedRef = useRef(false);
  const syncedOnOpenRef = useRef<string | null>(null);
  useEffect(() => {
    if (!notebook || loading) return;
    // One-time repair + sync of existing doc on first open — shared
    // across ALL hook instances (see onOpenSyncPromises above). Every
    // instance reloads once the single sync settles so the Smartboard
    // and the Presenter Preview hold the SAME section/subsection IDs.
    if (notebook.document_json && syncedOnOpenRef.current !== notebook.id) {
      syncedOnOpenRef.current = notebook.id;
      // Repair raw-LaTeX paragraphs written before the brace-aware tokenizer
      // existed so the lesson note renders math the same way AI Edit does.
      const { doc: repaired, changed } = repairDocumentMath(notebook.document_json);
      if (changed) {
        setNotebook((prev) => prev ? { ...prev, document_json: repaired } : prev);
        supabase.from("notebooks").update({ document_json: repaired } as any).eq("id", notebook.id);
      }
      let syncP = onOpenSyncPromises.get(notebook.id);
      if (!syncP) {
        syncP = withTimeout(
          syncDocumentToNotebook(notebook.id, repaired),
          20_000,
          "Notebook synchronization timed out",
        ).catch((e) => {
          // eslint-disable-next-line no-console
          console.warn("[syncDocumentToNotebook on open] failed:", e);
        });
        onOpenSyncPromises.set(notebook.id, syncP);
      }
      void syncP.then(() => reload());
    }
    if (notebook.document_json) { migratedRef.current = true; return; }
    if (migratedRef.current) return;
    migratedRef.current = true;
    // Build a ProseMirror doc from existing blocks (or seed an empty one).
    const blocks: any[] = [];
    sections.forEach((sec) => {
      blocks.push({
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: SECTION_LABEL[sec.kind] + (sec.title ? `: ${sec.title}` : "") }],
      });
      sec.loose.forEach((b) => {
        (b.content_ascii || "").split("\n").forEach((ln) => {
          blocks.push({ type: "paragraph", content: ln ? [{ type: "text", text: ln }] : [] });
        });
      });
      sec.subsections.forEach((ss, idx) => {
        if (sec.subsections.length > 1) {
          blocks.push({
            type: "heading", attrs: { level: 3 },
            content: [{ type: "text", text: `${SECTION_LABEL[sec.kind]} ${idx + 1}` }],
          });
        }
        ss.blocks.forEach((b) => {
          if (b.kind !== "text") {
            blocks.push({
              type: "paragraph",
              content: [{ type: "text", marks: [{ type: "bold" }], text: b.kind.charAt(0).toUpperCase() + b.kind.slice(1) + ": " }],
            });
          }
          (b.content_ascii || "").split("\n").forEach((ln) => {
            blocks.push({ type: "paragraph", content: ln ? [{ type: "text", text: ln }] : [] });
          });
        });
      });
    });
    if (blocks.length === 0) blocks.push({ type: "paragraph" });
    const doc = { type: "doc", content: blocks };
    setNotebook((prev) => prev ? { ...prev, document_json: doc } : prev);
    supabase.from("notebooks").update({ document_json: doc } as any).eq("id", notebook.id);
    // Newly-migrated doc — sync immediately too.
    syncDocumentToNotebook(notebook.id, doc).catch(() => { /* noop */ });
  }, [notebook, sections, loading]);


  const addSection = useCallback(
    async (kind: SectionKind) => {
      if (!notebookId) return;
      const order_index = sections.length;
      const { data, error } = await supabase
        .from("notebook_sections")
        .insert({ notebook_id: notebookId, kind, order_index })
        .select()
        .single();
      if (error || !data) {
        toast({ title: "Could not add section", variant: "destructive" });
        return;
      }
      if (isNumberedKind(kind)) {
        // seed first subsection
        const { data: sub } = await supabase
          .from("notebook_subsections")
          .insert({ section_id: data.id, order_index: 0 })
          .select()
          .single();
        if (sub) {
          await supabase.from("notebook_blocks").insert([
            { section_id: data.id, subsection_id: sub.id, kind: "problem", order_index: 0 },
            { section_id: data.id, subsection_id: sub.id, kind: "solution", order_index: 1 },
            { section_id: data.id, subsection_id: sub.id, kind: "reasoning", order_index: 2 },
          ]);
        }
      } else {
        await supabase
          .from("notebook_blocks")
          .insert({ section_id: data.id, kind: "text", order_index: 0 });
      }
      await reload();
    },
    [notebookId, sections.length, reload],
  );

  const addSubsection = useCallback(
    async (sectionId: string) => {
      const sec = sections.find((s) => s.id === sectionId);
      if (!sec) return;
      const order_index = sec.subsections.length;
      const { data: sub, error } = await supabase
        .from("notebook_subsections")
        .insert({ section_id: sectionId, order_index })
        .select()
        .single();
      if (error || !sub) {
        toast({ title: "Could not add subsection", variant: "destructive" });
        return;
      }
      await supabase.from("notebook_blocks").insert([
        { section_id: sectionId, subsection_id: sub.id, kind: "problem", order_index: 0 },
        { section_id: sectionId, subsection_id: sub.id, kind: "solution", order_index: 1 },
        { section_id: sectionId, subsection_id: sub.id, kind: "reasoning", order_index: 2 },
      ]);
      await reload();
    },
    [sections, reload],
  );

  /**
   * Append a free-text loose block to the end of the document. If no section
   * exists yet, create a default `explanation` section first. Returns the new
   * block id so the caller can focus it.
   */
  const appendTextBlock = useCallback(async (): Promise<string | null> => {
    if (!notebookId) return null;
    let targetSectionId = sections.length > 0 ? sections[sections.length - 1].id : null;
    if (!targetSectionId) {
      const { data: secData, error: secErr } = await supabase
        .from("notebook_sections")
        .insert({ notebook_id: notebookId, kind: "explanation", order_index: 0 })
        .select()
        .single();
      if (secErr || !secData) {
        toast({ title: "Could not add line", variant: "destructive" });
        return null;
      }
      targetSectionId = secData.id;
    }
    // Compute next order_index across loose blocks in that section.
    const lastSec = sections.find((s) => s.id === targetSectionId);
    const looseCount = lastSec?.loose.length ?? 0;
    const { data, error } = await supabase
      .from("notebook_blocks")
      .insert({ section_id: targetSectionId, kind: "text", order_index: 1000 + looseCount })
      .select()
      .single();
    if (error || !data) {
      toast({ title: "Could not add line", variant: "destructive" });
      return null;
    }
    await reload();
    return data.id as string;
  }, [notebookId, sections, reload]);


  const deleteSection = useCallback(
    async (sectionId: string) => {
      await supabase.from("notebook_sections").delete().eq("id", sectionId);
      await reload();
    },
    [reload],
  );

  const deleteSubsection = useCallback(
    async (subsectionId: string) => {
      await supabase.from("notebook_subsections").delete().eq("id", subsectionId);
      await reload();
    },
    [reload],
  );

  // local optimistic update of block text
  const updateBlockLocal = useCallback((blockId: string, ascii: string) => {
    setSections((prev) =>
      prev.map((sec) => ({
        ...sec,
        loose: sec.loose.map((b) => (b.id === blockId ? { ...b, content_ascii: ascii } : b)),
        subsections: sec.subsections.map((ss) => ({
          ...ss,
          blocks: ss.blocks.map((b) => (b.id === blockId ? { ...b, content_ascii: ascii } : b)),
        })),
      })),
    );
  }, []);

  const updateNotebook = useCallback(
    async (patch: Partial<Pick<NotebookRow, "title" | "subject" | "subtopic" | "class_name" | "teacher" | "session">>) => {
      if (!notebookId) return;
      setNotebook((prev) => (prev ? { ...prev, ...patch } : prev));
      const { error } = await supabase.from("notebooks").update(patch).eq("id", notebookId);
      if (error) toast({ title: "Could not save notebook", variant: "destructive" });
    },
    [notebookId],
  );

  const updateBlockContent = useCallback(async (blockId: string, ascii: string) => {
    setSections((prev) =>
      prev.map((sec) => ({
        ...sec,
        loose: sec.loose.map((b) => (b.id === blockId ? { ...b, content_ascii: ascii } : b)),
        subsections: sec.subsections.map((ss) => ({
          ...ss,
          blocks: ss.blocks.map((b) => (b.id === blockId ? { ...b, content_ascii: ascii } : b)),
        })),
      })),
    );
    await supabase.from("notebook_blocks").update({ content_ascii: ascii }).eq("id", blockId);
  }, []);

  /** Insert one or more new numbered subsections seeded with given problem strings into a section. */
  const insertProblemsIntoSection = useCallback(
    async (sectionId: string, problems: string[]) => {
      const sec = sections.find((s) => s.id === sectionId);
      if (!sec) return;
      let order = sec.subsections.length;
      for (const p of problems) {
        const { data: sub } = await supabase
          .from("notebook_subsections")
          .insert({ section_id: sectionId, order_index: order++ })
          .select()
          .single();
        if (!sub) continue;
        await supabase.from("notebook_blocks").insert([
          { section_id: sectionId, subsection_id: sub.id, kind: "problem", order_index: 0, content_ascii: p },
          { section_id: sectionId, subsection_id: sub.id, kind: "solution", order_index: 1, content_ascii: "" },
          { section_id: sectionId, subsection_id: sub.id, kind: "reasoning", order_index: 2, content_ascii: "" },
        ]);
      }
      await reload();
    },
    [sections, reload],
  );

  /** Swap two blocks' content in one round-trip (used by solve_with_reasoning). */
  const updateTwoBlocks = useCallback(
    async (a: { id: string; content: string }, b: { id: string; content: string }) => {
      setSections((prev) =>
        prev.map((sec) => ({
          ...sec,
          loose: sec.loose.map((bl) =>
            bl.id === a.id ? { ...bl, content_ascii: a.content } : bl.id === b.id ? { ...bl, content_ascii: b.content } : bl,
          ),
          subsections: sec.subsections.map((ss) => ({
            ...ss,
            blocks: ss.blocks.map((bl) =>
              bl.id === a.id ? { ...bl, content_ascii: a.content } : bl.id === b.id ? { ...bl, content_ascii: b.content } : bl,
            ),
          })),
        })),
      );
      await Promise.all([
        supabase.from("notebook_blocks").update({ content_ascii: a.content }).eq("id", a.id),
        supabase.from("notebook_blocks").update({ content_ascii: b.content }).eq("id", b.id),
      ]);
    },
    [],
  );

  /** Move a section up or down by swapping order_index with its neighbour. */
  const moveSection = useCallback(
    async (sectionId: string, direction: "up" | "down") => {
      const idx = sections.findIndex((s) => s.id === sectionId);
      if (idx < 0) return;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sections.length) return;
      const a = sections[idx];
      const b = sections[swapIdx];
      setSections((prev) => {
        const next = [...prev];
        next[idx] = { ...b, order_index: a.order_index };
        next[swapIdx] = { ...a, order_index: b.order_index };
        return next;
      });
      await Promise.all([
        supabase.from("notebook_sections").update({ order_index: b.order_index }).eq("id", a.id),
        supabase.from("notebook_sections").update({ order_index: a.order_index }).eq("id", b.id),
      ]);
      await reload();
    },
    [sections, reload],
  );

  /** Save the Word-style document body (ProseMirror JSON). Debounced upstream. */
  const saveDocumentJson = useCallback(
    async (json: any) => {
      if (!notebookId) return;
      setNotebook((prev) => (prev ? { ...prev, document_json: json } : prev));
      const { error } = await supabase
        .from("notebooks")
        .update({ document_json: json } as any)
        .eq("id", notebookId);
      if (error) {
        toast({ title: "Could not save document", variant: "destructive" });
        return;
      }
      // Mirror the document into the legacy section/subsection/block tables
      // so the Smartboard presents what's actually in the lesson note.
      try {
        await syncDocumentToNotebook(notebookId, json);
      } catch (e) {
        // non-blocking — document is saved either way
        // eslint-disable-next-line no-console
        console.warn("[syncDocumentToNotebook] failed:", e);
      }
    },
    [notebookId],
  );

  /** Update paper appearance (size + style). */
  const updatePaperSettings = useCallback(
    async (patch: { paper_size?: string; paper_style?: string; page_extra_mm?: number }) => {
      if (!notebookId) return;
      setNotebook((prev) => (prev ? { ...prev, ...patch } : prev));
      await supabase.from("notebooks").update(patch as any).eq("id", notebookId);
    },
    [notebookId],
  );

  /** Persist per-notebook zoom (debounced upstream). */
  const saveZoom = useCallback(
    async (zoom: number) => {
      if (!notebookId) return;
      setNotebook((prev) => (prev ? { ...prev, zoom } : prev));
      await supabase.from("notebooks").update({ zoom } as any).eq("id", notebookId);
    },
    [notebookId],
  );

  /** Convert the legacy block layout into a ProseMirror doc and turn on document mode. */
  const enableDocumentMode = useCallback(async () => {
    if (!notebookId) return;
    const blocks: any[] = [];
    sections.forEach((sec) => {
      blocks.push({
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: SECTION_LABEL[sec.kind] + (sec.title ? `: ${sec.title}` : "") }],
      });
      sec.loose.forEach((b) => {
        const lines = (b.content_ascii || "").split("\n");
        lines.forEach((ln) => {
          blocks.push({
            type: "paragraph",
            content: ln ? [{ type: "text", text: ln }] : [],
          });
        });
      });
      sec.subsections.forEach((ss, idx) => {
        if (sec.subsections.length > 1) {
          blocks.push({
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: `${SECTION_LABEL[sec.kind]} ${idx + 1}` }],
          });
        }
        ss.blocks.forEach((b) => {
          if (b.kind !== "text") {
            blocks.push({
              type: "paragraph",
              content: [{ type: "text", marks: [{ type: "bold" }], text: b.kind.charAt(0).toUpperCase() + b.kind.slice(1) + ": " }],
            });
          }
          const lines = (b.content_ascii || "").split("\n");
          lines.forEach((ln) => {
            blocks.push({
              type: "paragraph",
              content: ln ? [{ type: "text", text: ln }] : [],
            });
          });
        });
      });
    });
    if (blocks.length === 0) blocks.push({ type: "paragraph" });
    const doc = { type: "doc", content: blocks };
    await saveDocumentJson(doc);
  }, [notebookId, sections, saveDocumentJson]);

  return {
    notebook,
    sections,
    loading,
    reload,
    addSection,
    addSubsection,
    deleteSection,
    deleteSubsection,
    updateBlockLocal,
    updateNotebook,
    updateBlockContent,
    updateTwoBlocks,
    insertProblemsIntoSection,
    moveSection,
    appendTextBlock,
    saveDocumentJson,
    updatePaperSettings,
    saveZoom,
    enableDocumentMode,
  };
}



/** Persist a block's ascii content with debounce (per-block). */
export function useBlockAutosave() {
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const schedule = useCallback((blockId: string, ascii: string) => {
    const existing = timers.current.get(blockId);
    if (existing) clearTimeout(existing);
    const t = setTimeout(async () => {
      await supabase
        .from("notebook_blocks")
        .update({ content_ascii: ascii })
        .eq("id", blockId);
      timers.current.delete(blockId);
    }, 500);
    timers.current.set(blockId, t);
  }, []);
  useEffect(
    () => () => {
      timers.current.forEach((t) => clearTimeout(t));
    },
    [],
  );
  return schedule;
}

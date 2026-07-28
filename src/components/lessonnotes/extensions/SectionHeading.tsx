// Heading extension that adds a faint inline ✨ AI chip beside any H1/H2/H3
// whose text matches a known lesson-section name (Introduction, Example, etc.).
// Built on top of TipTap's default heading so all editing behaviour
// (typing, formatting, splitting) keeps working — we only swap the renderer.
//
// The AiPopover hosts the prompt + voice + image upload AND the
// Regenerate / Paraphrase / Extend / Clear actions, so the heading row stays
// uncluttered. If any descendant block in this section carries a
// `subsectionId` (written by persistGeneratedExample), we also render a faint
// "Floating numbers" chip that opens the existing FloatingNumbers workspace.

import Heading from "@tiptap/extension-heading";
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent, type NodeViewProps } from "@tiptap/react";
import { Sparkles, Loader2, RotateCcw, Wand2, ArrowDownToDot, Eraser, Hash, Users } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AiPopover, type AiGenerateOptions } from "../AiPopover";
import { AssignDialog } from "../AssignDialog";
import { detectSectionKind, SECTION_LABELS, REPEATABLE_SECTION_KINDS, type SectionKind } from "@/lib/lessonnotes/sectionKinds";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type SectionAction =
  | "generate"     // append fresh content (default)
  | "regenerate"   // replace existing content with a fresh draft
  | "paraphrase"   // rewrite existing content in simpler words
  | "extend"       // continue from the end of existing content
  | "clear";       // delete this section's content (no AI call)

export interface SectionAiCallContext {
  kind: SectionKind;
  headingPos: number;
  sectionEndPos: number;
  headingText: string;
  sectionText: string;
  action: SectionAction;
  images: string[];
}

interface SectionHeadingOptions {
  levels?: number[];
  onGenerateSection: (prompt: string, ctx: SectionAiCallContext) => Promise<void>;
  HTMLAttributes?: Record<string, any>;
}

function SectionHeadingView(props: NodeViewProps) {
  const { node, getPos, editor, extension } = props;
  const opts = extension.options as SectionHeadingOptions;
  const navigate = useNavigate();
  const { id: notebookId } = useParams();
  const [busy, setBusy] = useState<SectionAction | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignSub, setAssignSub] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const level: number = node.attrs.level ?? 2;
  const text = node.textContent;
  const kind = (level <= 3) ? detectSectionKind(text) : null;

  const computeSection = useCallback(() => {
    const pos = typeof getPos === "function" ? getPos() : null;
    if (pos == null) return null;
    const doc = editor.state.doc;
    let endPos = doc.content.size;
    doc.descendants((n, p) => {
      if (p <= pos) return true;
      if (n.type.name === "heading" && (n.attrs.level ?? 6) <= level) {
        if (endPos === doc.content.size) endPos = p;
        return false;
      }
      return true;
    });
    const headingNodeSize = node.nodeSize;
    const contentStart = pos + headingNodeSize;
    const sectionText = contentStart < endPos
      ? doc.textBetween(contentStart, endPos, "\n", "\n").trim()
      : "";
    // Find any descendant block carrying a subsectionId (set by persist step).
    let subsectionId: string | null = null;
    if (contentStart < endPos) {
      doc.nodesBetween(contentStart, endPos, (n) => {
        const id = (n.attrs as any)?.subsectionId;
        if (id && !subsectionId) subsectionId = id;
      });
    }
    return { pos, endPos, sectionText, subsectionId };
  }, [getPos, editor, level, node]);

  // Recompute the floating-link target whenever the editor doc changes.
  // useMemo with editor.state.doc as the dep is enough — TipTap re-renders the
  // node view on doc updates.
  const sectionInfo = useMemo(() => computeSection(), [computeSection, editor.state.doc]);
  const subsectionId = sectionInfo?.subsectionId ?? null;

  const run = useCallback(async (
    action: SectionAction,
    prompt: string,
    aiOpts: AiGenerateOptions = { images: [] },
  ) => {
    if (!kind) return;
    const info = computeSection();
    if (!info) return;
    setBusy(action);
    try {
      await opts.onGenerateSection(prompt, {
        kind,
        headingPos: info.pos,
        sectionEndPos: info.endPos,
        headingText: text,
        sectionText: info.sectionText,
        action,
        images: aiOpts.images,
      });
    } finally {
      setBusy(null);
    }
  }, [kind, computeSection, opts, text]);

  /** Where this Solution heading sits in the document, expressed in the same
   *  index space the sync layer uses for notebook_sections /
   *  notebook_subsections rows. */
  const locateIndices = useCallback((): { parentSectionIndex: number; subsectionIndex: number } | null => {
    if (!notebookId || kind !== "solution") return null;
    const pos = typeof getPos === "function" ? getPos() : null;
    if (pos == null) return null;
    const doc = editor.state.doc;
    // Collect top-level H1/H2 section boundaries (parsed[] index parity).
    const topHeadings: { pos: number; kind: SectionKind | null }[] = [];
    doc.descendants((n, p) => {
      if (n.type.name === "heading" && (n.attrs.level ?? 6) <= 2) {
        topHeadings.push({ pos: p, kind: detectSectionKind(n.textContent) });
        return false;
      }
      return true;
    });
    // Filter to ones the sync layer keeps as sections (skip "solution").
    const sectionList = topHeadings.filter((h) => h.kind && h.kind !== "solution");
    let parentSectionIndex = -1;
    for (let i = 0; i < sectionList.length; i++) {
      if (sectionList[i].pos < pos) parentSectionIndex = i;
      else break;
    }
    if (parentSectionIndex < 0) return null;
    // Count Solution H3s that precede this one within the parent section.
    const parentStart = sectionList[parentSectionIndex].pos;
    const parentEnd = parentSectionIndex + 1 < sectionList.length
      ? sectionList[parentSectionIndex + 1].pos
      : doc.content.size;
    let subsectionIndex = 0;
    let selfFound = false;
    doc.descendants((n, p) => {
      if (p < parentStart || p >= parentEnd) return true;
      if (p === pos) { selfFound = true; return false; }
      if (n.type.name === "heading" && (n.attrs.level ?? 6) <= 3) {
        const t = (n.textContent || "").toLowerCase().trim();
        if (t.startsWith("solution") || t.includes("worked solution")) {
          subsectionIndex += 1;
        }
      }
      return true;
    });
    if (!selfFound) return null;
    return { parentSectionIndex, subsectionIndex };
  }, [notebookId, kind, getPos, editor]);

  /** When the cached subsectionId attr is stale (sync rewrites IDs on every
   *  save), resolve the live subsection for this Solution heading by matching
   *  its position within the doc against the DB ordering. */
  const resolveSubsectionId = useCallback(async (): Promise<string | null> => {
    const at = locateIndices();
    if (!at || !notebookId) return null;
    // Look up sections in DB order, take parentSectionIndex.
    const { data: secs } = await supabase
      .from("notebook_sections")
      .select("id, order_index")
      .eq("notebook_id", notebookId)
      .order("order_index", { ascending: true });
    const sec = (secs ?? [])[at.parentSectionIndex] as any;
    if (!sec?.id) return null;
    const { data: subs } = await supabase
      .from("notebook_subsections")
      .select("id, order_index")
      .eq("section_id", sec.id)
      .order("order_index", { ascending: true });
    const sub = (subs ?? [])[at.subsectionIndex] as any;
    return sub?.id ?? null;
  }, [locateIndices, notebookId]);

  /** Floating Numbers must ALWAYS be reachable from a Solution heading, even
   *  when the solution is still empty — the workspace simply opens blank.
   *  Resolve first; if the backing rows don't exist yet (brand-new section
   *  that hasn't synced, or an empty question the sync layer skipped), create
   *  them on the spot instead of refusing with a toast. */
  const ensureSubsectionId = useCallback(async (): Promise<string | null> => {
    const resolved = await resolveSubsectionId();
    if (resolved) return resolved;
    if (!notebookId) return null;
    const at = locateIndices();
    if (!at) return null;

    const { data: secs } = await supabase
      .from("notebook_sections")
      .select("id, order_index")
      .eq("notebook_id", notebookId)
      .order("order_index", { ascending: true });
    let sectionId = ((secs ?? [])[at.parentSectionIndex] as any)?.id as string | undefined;
    if (!sectionId) {
      const { data: created } = await supabase
        .from("notebook_sections")
        .insert({
          notebook_id: notebookId,
          kind: "example" as any,
          order_index: (secs ?? []).length,
        })
        .select("id")
        .single();
      sectionId = (created as any)?.id;
    }
    if (!sectionId) return null;

    const { data: subs } = await supabase
      .from("notebook_subsections")
      .select("id, order_index")
      .eq("section_id", sectionId)
      .order("order_index", { ascending: true });
    const existingSub = ((subs ?? [])[at.subsectionIndex] as any)?.id as string | undefined;
    if (existingSub) return existingSub;

    const { data: newSub } = await supabase
      .from("notebook_subsections")
      .insert({
        section_id: sectionId,
        order_index: (subs ?? []).length,
        floating_lines: [],
      })
      .select("id")
      .single();
    const subId = (newSub as any)?.id as string | undefined;
    if (!subId) return null;
    await supabase.from("notebook_blocks").insert([
      { section_id: sectionId, subsection_id: subId, kind: "problem" as any, order_index: 0, content_ascii: "" },
      { section_id: sectionId, subsection_id: subId, kind: "solution" as any, order_index: 1, content_ascii: "" },
      { section_id: sectionId, subsection_id: subId, kind: "reasoning" as any, order_index: 2, content_ascii: "" },
    ]);
    return subId;
  }, [resolveSubsectionId, locateIndices, notebookId]);






  return (
    <NodeViewWrapper className="section-heading-wrapper group relative">
      <NodeViewContent as={`h${level}` as any} />
      {kind && (
        <span
          contentEditable={false}
          className="lesson-section-side-actions select-none print:hidden"
        >
          <AiPopover
            title={`${SECTION_LABELS[kind]} — AI`}
            placeholder={`What should the ${SECTION_LABELS[kind].toLowerCase()} cover?`}
            hint="Type, speak, or attach a photo. AI inserts at the end of this section."
            allowAttachments
            onGenerate={(p, o) => run("generate", p, o)}
            footerActions={[
              { id: "regenerate", label: "Regenerate", icon: <RotateCcw className="h-3 w-3" />, onRun: () => run("regenerate", "") },
              { id: "paraphrase", label: "Paraphrase", icon: <Wand2 className="h-3 w-3" />,     onRun: () => run("paraphrase", "") },
              { id: "extend",     label: "Extend",     icon: <ArrowDownToDot className="h-3 w-3" />, onRun: () => run("extend", "") },
              { id: "clear",      label: "Clear",      icon: <Eraser className="h-3 w-3" />,    onRun: () => run("clear", ""), danger: true },
            ]}
            trigger={
              <button
                type="button"
                className="lesson-section-ai-trigger inline-flex items-center gap-1 text-[10px] uppercase tracking-wider transition"
                title={`AI — ${SECTION_LABELS[kind]}`}
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                AI
              </button>
            }
          />
          {notebookId && kind === "solution" && (
            <button
              type="button"
              onClick={async () => {
                // Cached id first (cheapest), then live resolution, then
                // create-on-demand. An empty solution still opens — blank.
                let target: string | null = null;
                if (subsectionId) {
                  const { data: liveCached } = await supabase
                    .from("notebook_subsections")
                    .select("id")
                    .eq("id", subsectionId)
                    .maybeSingle();
                  target = (liveCached as any)?.id ?? null;
                }
                if (!target) target = await ensureSubsectionId();
                if (target) {
                  navigate(`/lesson-notes/${notebookId}/floating-prep/${target}`);
                  return;
                }
                toast({
                  title: "Couldn't open floating numbers",
                  description: "Try again in a moment.",
                });
              }}

              className="lesson-section-ai-trigger inline-flex items-center gap-1 text-[10px] uppercase tracking-wider transition"
              title="Open floating numbers for this section"
            >
              <Hash className="h-3 w-3" />
              Floating
            </button>
          )}
          {notebookId && kind === "solution" && (
            <button
              type="button"
              onClick={async () => {
                setAssigning(true);
                try {
                  let target = await resolveSubsectionId();
                  if (!target && subsectionId) {
                    const { data: liveCached } = await supabase
                      .from("notebook_subsections")
                      .select("id")
                      .eq("id", subsectionId)
                      .maybeSingle();
                    target = liveCached?.id ?? null;
                  }
                  if (!target) {
                    toast({
                      title: "Not ready to assign",
                      description: "Save the document first, then try again.",
                    });
                    return;
                  }
                  setAssignSub(target);
                  setAssignOpen(true);
                } finally {
                  setAssigning(false);
                }
              }}
              className="lesson-section-ai-trigger inline-flex items-center gap-1 text-[10px] uppercase tracking-wider transition"
              title="Assign this question to students"
            >
              {assigning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Users className="h-3 w-3" />}
              Assign
            </button>
          )}
        </span>
      )}
      {notebookId && (
        <AssignDialog
          open={assignOpen}
          onOpenChange={setAssignOpen}
          subsectionId={assignSub}
          notebookId={notebookId}
          defaultTitle=""
        />
      )}
    </NodeViewWrapper>
  );
}

export const SectionHeading = Heading.extend<SectionHeadingOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      levels: [1, 2, 3],
      onGenerateSection: async () => {},
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(SectionHeadingView);
  },
  addProseMirrorPlugins() {
    return [buildAddAnotherPlugin()];
  },
});

// ---------------------------------------------------------------------------
// "+ Add another <Example>" widget at the end of every repeatable section.
// Implemented as ProseMirror decorations so the button truly appears at the
// section's end, not under its heading.
// ---------------------------------------------------------------------------

import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

const ADD_ANOTHER_KEY = new PluginKey("lesson-add-another");

function buildAddAnotherPlugin() {
  const build = (doc: any): DecorationSet => {
    const decos: Decoration[] = [];
    // Collect headings with their pos + kind + level + label.
    const headings: { pos: number; level: number; kind: SectionKind; text: string }[] = [];
    doc.descendants((n: any, p: number) => {
      if (n.type.name === "heading") {
        const lvl = (n.attrs.level ?? 6) as number;
        const k = detectSectionKind(n.textContent);
        if (k) headings.push({ pos: p, level: lvl, kind: k, text: n.textContent });
      }
    });
    for (let i = 0; i < headings.length; i++) {
      const h = headings[i];
      if (!REPEATABLE_SECTION_KINDS.has(h.kind)) continue;
      // section end = pos of next heading with level <= this one, else doc end.
      let endPos = doc.content.size;
      for (let j = i + 1; j < headings.length; j++) {
        if (headings[j].level <= h.level) { endPos = headings[j].pos; break; }
      }
      const widget = Decoration.widget(endPos, () => {
        const wrapper = document.createElement("div");
        wrapper.className = "lesson-add-another-wrap print:hidden";
        wrapper.setAttribute("contenteditable", "false");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "lesson-add-another-btn";
        btn.title = `Add another ${SECTION_LABELS[h.kind].toLowerCase()}`;
        btn.setAttribute("aria-label", `Add another ${SECTION_LABELS[h.kind].toLowerCase()}`);
        btn.textContent = "+";
        btn.addEventListener("mousedown", (e) => {
          e.preventDefault();
          // Recompute count + insertion from a fresh view at click time.
          const view = (btn as any).__view;
          if (!view) return;
          const state = view.state;
          let count = 0;
          state.doc.descendants((n: any) => {
            if (n.type.name === "heading" && (n.attrs.level ?? 6) === h.level) {
              if (detectSectionKind(n.textContent) === h.kind) count += 1;
            }
          });
          const label = `${SECTION_LABELS[h.kind]} ${count + 1}`;
          const headingType = state.schema.nodes.heading;
          const paragraphType = state.schema.nodes.paragraph;
          const newHeading = headingType.create({ level: h.level }, state.schema.text(label));
          const newPara = paragraphType.create();
          // Question-style sections always ship with an empty Solution space,
          // so a teacher can type the problem AND the solution without AI.
          const wantsSolution = h.kind !== "game_questions";
          const solutionNodes = wantsSolution
            ? [
                headingType.create({ level: Math.min(6, h.level + 1) }, state.schema.text("Solution")),
                paragraphType.create(),
              ]
            : [];
          // Re-derive the end position from the live state in case the doc changed.
          let liveEnd = state.doc.content.size;
          const liveHeadings: { pos: number; level: number; kind: SectionKind | null }[] = [];
          state.doc.descendants((n: any, p: number) => {
            if (n.type.name === "heading") {
              liveHeadings.push({
                pos: p, level: n.attrs.level ?? 6,
                kind: detectSectionKind(n.textContent),
              });
            }
          });
          const selfIdx = liveHeadings.findIndex((x) => x.pos === h.pos);
          if (selfIdx >= 0) {
            for (let j = selfIdx + 1; j < liveHeadings.length; j++) {
              if (liveHeadings[j].level <= h.level) { liveEnd = liveHeadings[j].pos; break; }
            }
          }
          const tr = state.tr.insert(liveEnd, [newHeading, newPara, ...solutionNodes]);
          // Caret inside the new empty paragraph.
          const caret = liveEnd + newHeading.nodeSize + 1;
          tr.setSelection(TextSelection.near(tr.doc.resolve(caret)));
          view.dispatch(tr);
          view.focus();
        });
        // Stash a reference to the view so the handler can read live state.
        // Set via the plugin's view hook below.
        (wrapper as any).__btn = btn;
        wrapper.appendChild(btn);
        return wrapper;
      }, { side: 1, key: `add-another-${h.pos}-${h.kind}` });
      decos.push(widget);
    }
    return DecorationSet.create(doc, decos);
  };

  return new Plugin({
    key: ADD_ANOTHER_KEY,
    state: {
      init: (_, { doc }) => build(doc),
      apply: (tr, old) => tr.docChanged ? build(tr.doc) : old,
    },
    props: {
      decorations(state) { return this.getState(state); },
    },
    view(editorView) {
      const attach = () => {
        editorView.dom.querySelectorAll(".lesson-add-another-wrap").forEach((wrap) => {
          const btn = (wrap as any).__btn as HTMLButtonElement | undefined;
          if (btn) (btn as any).__view = editorView;
        });
      };
      attach();
      return {
        update() { attach(); },
      };
    },
  });
}


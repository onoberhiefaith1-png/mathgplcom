// SESSION CONTEXT PACKAGE
//
// The AI must never judge a request from one block alone. A question, its
// diagram and its solution frequently live in different blocks of the same
// session: the Exercise says "Find the value of x", the figure sits under the
// Solution heading, and the working is in a free frame. Reading only the
// clicked block is what produced "no mathematical question has been written
// yet" and "could not read the material".
//
// This module derives — read-only — everything the AI needs for one insertion
// point: the focused block, the question that owns it, that question's diagram
// and solution, and a compact digest of the rest of the session.

import type { Node as PMNode } from "@tiptap/pm/model";
import { detectSectionKind, headingRole, type SectionKind } from "@/lib/lessonnotes/sectionKinds";
import { isSolutionHeadingText } from "@/lib/geometry/map/solutionText";

export interface SessionQuestionEntry {
  /** Position of the heading that owns this block. */
  pos: number;
  /** End of the block's span (exclusive). */
  end: number;
  heading: string;
  kind: SectionKind | null;
  questionId: string | null;
  /** Mathematics/text between the heading and its Solution heading. */
  questionText: string;
  /** Mathematics/text of the Solution belonging to this question. */
  solutionText: string;
  /** Text inventory of the diagram(s) this question owns. */
  diagramSummary: string;
  hasDiagram: boolean;
}

export interface SessionContextPackage {
  sessionTitle: string;
  scope: { from: number; to: number };
  entries: SessionQuestionEntry[];
  /** The block that contains the insertion point. */
  owner: SessionQuestionEntry | null;
  hasAnyContent: boolean;
}

export interface RelatedContent {
  /** Solution text of the same question, when one exists. */
  solutionText: string;
  /** Diagram inventory of the same question. */
  diagramSummary: string;
  /** Mathematics found elsewhere in the same session. */
  sessionText: string;
}

interface HeadingInfo { pos: number; size: number; level: number; text: string; attrs: any }

const isQuestionHeading = (h: HeadingInfo) => h.level <= 2 && !isSolutionHeadingText(h.text);

/**
 * Build the session context package for `pos`.
 *
 * `serialize` is the caller's math-aware range serialiser (math nodes must
 * contribute their value, not empty text), and `diagramSummary` turns a
 * geometry scene into a text inventory.
 */
export function buildSessionContext(opts: {
  doc: PMNode;
  pos: number;
  serialize: (from: number, to: number) => string;
  diagramsFor: (headingPos: number) => Array<{ node: PMNode }>;
  diagramSummary: (scene: unknown) => string;
}): SessionContextPackage {
  const { doc, pos } = opts;
  const headings: HeadingInfo[] = [];
  doc.descendants((n, p) => {
    if (n.type.name === "heading") {
      headings.push({
        pos: p,
        size: n.nodeSize,
        level: ((n.attrs as any)?.level ?? 6) as number,
        text: n.textContent.trim(),
        attrs: n.attrs,
      });
      return false;
    }
    return true;
  });

  // ── session scope: the subtopic/session heading that owns `pos` ───────────
  let scopeFrom = 0;
  let sessionTitle = "";
  for (const h of headings) {
    if (h.pos >= pos) break;
    const role = headingRole(h.text, h.level);
    if (role?.role === "subtopic") { scopeFrom = h.pos; sessionTitle = role.title; }
  }
  let scopeTo = doc.content.size;
  for (const h of headings) {
    if (h.pos <= Math.max(scopeFrom, 0) || h.pos <= pos) continue;
    const role = headingRole(h.text, h.level);
    if (role?.role === "subtopic") { scopeTo = h.pos; break; }
  }

  const inScope = headings.filter((h) => h.pos >= scopeFrom && h.pos < scopeTo);
  const questionHeads = inScope.filter(isQuestionHeading);

  const entries: SessionQuestionEntry[] = [];
  for (let i = 0; i < questionHeads.length; i++) {
    const h = questionHeads[i];
    const spanStart = h.pos + h.size;
    const spanEnd = Math.min(questionHeads[i + 1]?.pos ?? scopeTo, scopeTo);
    if (spanEnd <= spanStart) {
      entries.push({
        pos: h.pos, end: spanEnd, heading: h.text, kind: detectSectionKind(h.text),
        questionId: (h.attrs?.sectionId as string) ?? null,
        questionText: "", solutionText: "", diagramSummary: "", hasDiagram: false,
      });
      continue;
    }
    // Split the span at its Solution heading (any level).
    const sol = inScope.find((x) => x.pos > h.pos && x.pos < spanEnd && isSolutionHeadingText(x.text));
    const questionText = safe(() => opts.serialize(spanStart, sol ? sol.pos : spanEnd));
    const solutionText = sol
      ? safe(() => opts.serialize(sol.pos + sol.size, spanEnd))
      : "";

    let diagramSummary = "";
    try {
      diagramSummary = opts
        .diagramsFor(h.pos)
        .map((d) => opts.diagramSummary((d.node.attrs as any)?.scene))
        .filter(Boolean)
        .join(" | ");
    } catch { diagramSummary = ""; }

    entries.push({
      pos: h.pos,
      end: spanEnd,
      heading: h.text,
      kind: detectSectionKind(h.text),
      questionId: (h.attrs?.sectionId as string) ?? null,
      questionText,
      solutionText,
      diagramSummary,
      hasDiagram: Boolean(diagramSummary),
    });
  }

  // The block containing `pos`, else the closest one above it.
  let owner: SessionQuestionEntry | null = null;
  for (const e of entries) {
    if (e.pos <= pos && pos < e.end) { owner = e; break; }
    if (e.pos <= pos) owner = e;
  }

  const hasAnyContent = entries.some(
    (e) => e.questionText.trim() || e.solutionText.trim() || e.hasDiagram,
  );

  return { sessionTitle, scope: { from: scopeFrom, to: scopeTo }, entries, owner, hasAnyContent };
}

const safe = (f: () => string): string => { try { return (f() ?? "").trim(); } catch { return ""; } };

/** Related content of the SAME question plus the rest of the session. */
export function relatedContentFor(pkg: SessionContextPackage): RelatedContent {
  const owner = pkg.owner;
  const others = pkg.entries
    .filter((e) => e !== owner)
    .map((e) => [e.heading, e.questionText, e.solutionText].filter(Boolean).join("\n"))
    .filter((s) => s.trim())
    .slice(-4);
  return {
    solutionText: owner?.solutionText ?? "",
    diagramSummary: owner?.diagramSummary ?? "",
    sessionText: others.join("\n\n"),
  };
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trim()}…` : s);

/** Prompt digest: the authoritative state of the session as it stands now. */
export function describeSessionContext(pkg: SessionContextPackage): string {
  const lines: string[] = [];
  if (pkg.sessionTitle) lines.push(`Session / subtopic: ${pkg.sessionTitle}`);
  for (const e of pkg.entries) {
    const parts: string[] = [];
    if (e.questionText.trim()) parts.push(`question: ${clip(e.questionText, 400)}`);
    if (e.diagramSummary) parts.push(`diagram already drawn: ${clip(e.diagramSummary, 300)}`);
    if (e.solutionText.trim()) parts.push(`solution present: ${clip(e.solutionText, 400)}`);
    if (!parts.length) parts.push("empty");
    const mark = e === pkg.owner ? " ← the block being generated" : "";
    lines.push(`• ${e.heading || e.kind || "Section"}${mark}\n    ${parts.join("\n    ")}`);
  }
  if (!lines.length) return "";
  return (
    "LESSON SESSION STATE (authoritative — this is what is already on the page).\n" +
    "If the teacher's question already exists here, reproduce it exactly; never replace it " +
    "with a different question.\n" + lines.join("\n")
  );
}

/** Material text assembled from the document when the teacher typed nothing. */
export function materialFromSession(pkg: SessionContextPackage): string {
  const o = pkg.owner;
  const parts: string[] = [];
  if (pkg.sessionTitle) parts.push(`Session: ${pkg.sessionTitle}`);
  if (o?.heading) parts.push(`Block: ${o.heading}`);
  if (o?.questionText.trim()) parts.push(`Question already written:\n${o.questionText.trim()}`);
  if (o?.diagramSummary) parts.push(`Diagram belonging to this question: ${o.diagramSummary}`);
  if (o?.solutionText.trim()) parts.push(`Solution already written:\n${o.solutionText.trim()}`);
  if (!o?.questionText.trim() && !o?.solutionText.trim() && !o?.diagramSummary) {
    const rest = relatedContentFor(pkg).sessionText;
    if (rest.trim()) parts.push(`Other blocks in this session:\n${clip(rest, 1200)}`);
  }
  return parts.join("\n\n").trim();
}

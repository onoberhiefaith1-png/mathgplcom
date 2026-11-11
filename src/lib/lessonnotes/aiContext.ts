// Central Lesson AI Context.
//
// The subtopic a teacher confirms is not merely text on the page — it is the
// AI's active working context. Every AI feature (introduction, explanation,
// examples, questions, solutions, diagrams, geometry maps, floating numbers…)
// must read the ACTIVE SUBTOPIC from here instead of guessing it from the
// document. The main Topic is never changed by a subtopic switch.

import { useCallback, useEffect, useRef, useState } from "react";

export interface LessonAiContext {
  subject: string;
  /** Notebook topic — never changed by subtopic edits. */
  topic: string;
  /** Last confirmed subtopic — authoritative for all new generation. */
  activeSubtopic: string;
  /** Heading position of the active subtopic in the document, when it has one. */
  activeSubtopicPos: number | null;
  /** History, in order of first use. Never destroyed. */
  previousSubtopics: string[];
}

export const sameSubtopic = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();


export function applyNotebookToAiContext(
  prev: LessonAiContext,
  n: { subject?: string; topic?: string; subtopic?: string; subtopicId?: string; forceSubtopic?: boolean },
): LessonAiContext {
  const subject = n.subject?.trim() || prev.subject || "Mathematics";
  const topic = n.topic?.trim() || prev.topic || "";
  const nextName = n.subtopic?.trim() || "";
  // A drawer switch is a new lesson: Copilot and AI Edit must follow it.
  // Otherwise only seed the subtopic, so a confirmed in-document heading
  // is not reset by a repeating notebook prop.
  const activeSubtopic = n.forceSubtopic
    ? (nextName || prev.activeSubtopic)
    : (prev.activeSubtopic || nextName);
  const headingChanged = n.forceSubtopic && !sameSubtopic(prev.activeSubtopic, activeSubtopic);
  if (subject === prev.subject && topic === prev.topic && activeSubtopic === prev.activeSubtopic && !headingChanged) {
    return prev;
  }
  return {
    ...prev,
    subject,
    topic,
    activeSubtopic,
    activeSubtopicPos: headingChanged ? null : prev.activeSubtopicPos,
  };
}


export interface LessonAiContextStore {
  ctx: LessonAiContext;
  /** Always read the latest value from event handlers / async work. */
  read: () => LessonAiContext;
  /** Confirm a subtopic as the active working context. */
  setActiveSubtopic: (title: string, pos: number | null) => void;
  /** Keep subject/topic in sync with the notebook. Pass forceSubtopic when the
   *  teacher has opened a different drawer subtopic so AI follows that lesson. */
  syncNotebook: (n: { subject?: string; topic?: string; subtopic?: string; subtopicId?: string; forceSubtopic?: boolean }) => void;
}

export function useLessonAiContextStore(
  notebook?: { subject?: string; topic?: string; subtopic?: string },
): LessonAiContextStore {
  const [ctx, setCtx] = useState<LessonAiContext>(() => ({
    subject: notebook?.subject?.trim() || "Mathematics",
    topic: notebook?.topic?.trim() || "",
    activeSubtopic: notebook?.subtopic?.trim() || "",
    activeSubtopicPos: null,
    previousSubtopics: [],
  }));
  const ref = useRef(ctx);
  useEffect(() => { ref.current = ctx; }, [ctx]);

  const syncNotebook = useCallback((n: { subject?: string; topic?: string; subtopic?: string; subtopicId?: string; forceSubtopic?: boolean }) => {
    setCtx((prev) => applyNotebookToAiContext(prev, n));
  }, []);

  const setActiveSubtopic = useCallback((title: string, pos: number | null) => {
    const name = title.trim();
    if (!name) return;
    setCtx((prev) => {
      if (sameSubtopic(prev.activeSubtopic, name) && prev.activeSubtopicPos === pos) return prev;
      const history = prev.activeSubtopic && !sameSubtopic(prev.activeSubtopic, name)
        ? [...prev.previousSubtopics.filter((s) => !sameSubtopic(s, prev.activeSubtopic)), prev.activeSubtopic]
        : prev.previousSubtopics;
      return { ...prev, activeSubtopic: name, activeSubtopicPos: pos, previousSubtopics: history };
    });
  }, []);

  return { ctx, read: () => ref.current, setActiveSubtopic, syncNotebook };
}

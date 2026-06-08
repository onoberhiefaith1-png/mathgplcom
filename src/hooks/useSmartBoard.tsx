// SmartBoard state — line-based, with workspace zoom and auto-advance on blue.
// Cursor tracks an optional inner container so structure templates (fractions,
// powers, roots, abs) place the cursor inside their first slot on insertion.

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Node } from "@/lib/mathboard/tokens";
import { asciiToNodes, nodesToAscii, splitAtEq } from "@/lib/smartboard/nodeUtils";
import { LineStatus, validateLine } from "@/lib/smartboard/lineValidator";
import { Difficulty, generateQuestion, Question } from "@/lib/smartboard/linearGenerator";
import { canonical, solveX } from "@/lib/smartboard/canonical";
import { buildStructure, type StructureId } from "@/lib/smartboard/structures";
import { Container, resolveContainer, findParent } from "@/lib/mathboard/cursor";

export interface SBLine {
  id: string;
  nodes: Node[];
  status: LineStatus;
}

interface Ctx {
  question: Question;
  lines: SBLine[];
  cursorIndex: number;
  cursorContainer: Container | null;
  difficulty: Difficulty;
  isComplete: boolean;
  workspaceZoom: number;
  scatterIdx: number;
  setWorkspaceZoom: (z: number) => void;
  activeLineRef: React.MutableRefObject<HTMLDivElement | null>;
  setDifficulty: (d: Difficulty) => void;
  insertAscii: (ascii: string) => void;
  insertNodes: (nodes: Node[]) => void;
  insertStructure: (id: StructureId) => void;
  backspace: () => void;
  moveCursor: (delta: 1 | -1) => void;
  moveCursorVertical: (dir: "up" | "down") => void;
  newQuestion: () => void;
  reset: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const SBContext = createContext<Ctx | null>(null);
const lid = () => `l${Math.random().toString(36).slice(2, 8)}`;
const cloneNodes = (n: Node[]): Node[] => JSON.parse(JSON.stringify(n));

const SLOT_PAIRS: Record<string, { down?: string; up?: string }> = {
  // structure -> from-slot navigation map
  frac_num: { down: "den" },
  frac_den: { up: "num" },
  power_base: { up: "exp" },
  power_exp:  { down: "base" },
};

export const SmartBoardProvider = ({ children }: { children: ReactNode }) => {
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [question, setQuestion] = useState<Question>(() => generateQuestion("easy"));
  const [lines, setLines] = useState<SBLine[]>([{ id: lid(), nodes: [], status: "empty" }]);
  const [cursorIndex, setCursorIndex] = useState(0);
  const [cursorContainer, setCursorContainer] = useState<Container | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [workspaceZoom, setWorkspaceZoom] = useState(1);
  const [scatterIdx, setScatterIdx] = useState(0);
  const activeLineRef = useRef<HTMLDivElement | null>(null);

  const loadQ = useCallback((q: Question) => {
    setQuestion(q);
    setLines([{ id: lid(), nodes: [], status: "empty" }]);
    setCursorIndex(0);
    setCursorContainer(null);
    setIsComplete(false);
    setScatterIdx(0);
  }, []);

  const newQuestion = useCallback(() => loadQ(generateQuestion(difficulty)), [difficulty, loadQ]);

  const setDiff = useCallback((d: Difficulty) => {
    setDifficulty(d);
    loadQ(generateQuestion(d));
  }, [loadQ]);

  const reset = useCallback(() => {
    setLines([{ id: lid(), nodes: [], status: "empty" }]);
    setCursorIndex(0);
    setCursorContainer(null);
    setIsComplete(false);
    setScatterIdx(0);
  }, []);

  type Snapshot = { lines: SBLine[]; cursorIndex: number; cursorContainer: Container | null };
  const undoStackRef = useRef<Snapshot[]>([]);
  const redoStackRef = useRef<Snapshot[]>([]);
  const [, forceTick] = useState(0);
  const ping = () => forceTick((t) => t + 1);

  const snapshot = useCallback(() => {
    undoStackRef.current.push({
      lines: lines.map((l) => ({ ...l, nodes: cloneNodes(l.nodes) })),
      cursorIndex,
      cursorContainer,
    });
    if (undoStackRef.current.length > 200) undoStackRef.current.shift();
    redoStackRef.current = [];
    ping();
  }, [lines, cursorIndex, cursorContainer]);

  const undo = useCallback(() => {
    const s = undoStackRef.current.pop();
    if (!s) return;
    redoStackRef.current.push({
      lines: lines.map((l) => ({ ...l, nodes: cloneNodes(l.nodes) })),
      cursorIndex,
      cursorContainer,
    });
    setLines(s.lines);
    setCursorIndex(s.cursorIndex);
    setCursorContainer(s.cursorContainer);
    ping();
  }, [lines, cursorIndex, cursorContainer]);

  const redo = useCallback(() => {
    const s = redoStackRef.current.pop();
    if (!s) return;
    undoStackRef.current.push({
      lines: lines.map((l) => ({ ...l, nodes: cloneNodes(l.nodes) })),
      cursorIndex,
      cursorContainer,
    });
    setLines(s.lines);
    setCursorIndex(s.cursorIndex);
    setCursorContainer(s.cursorContainer);
    ping();
  }, [lines, cursorIndex, cursorContainer]);

  // Mutate the array the cursor points at (root array OR a structure slot).
  const mutateActive = useCallback((
    fn: (target: Node[], cursor: number) => { nodes: Node[]; cursor: number; container?: Container | null },
  ) => {
    snapshot();
    setLines((prev) => {
      const arr = [...prev];
      const idx = arr.length - 1;
      const cur = arr[idx];
      const cloned = cloneNodes(cur.nodes);
      let target: Node[] | null = cloned;
      if (cursorContainer && cursorContainer.nodeId) {
        target = resolveContainer(cloned, { ...cursorContainer, sessionId: cur.id });
      }
      if (!target) {
        // Fallback to root if container resolution fails.
        target = cloned;
      }
      const r = fn(target, cursorIndex);
      // Replace the contents of `target` in place.
      target.length = 0;
      target.push(...r.nodes);
      arr[idx] = { ...cur, nodes: cloned, status: cur.status };
      setCursorIndex(r.cursor);
      if (r.container !== undefined) setCursorContainer(r.container);
      return arr;
    });
  }, [cursorIndex, cursorContainer, snapshot]);

  const insertNodes = useCallback((newNodes: Node[]) => {
    mutateActive((nodes, cur) => {
      const next = [...nodes];
      next.splice(cur, 0, ...newNodes);
      return { nodes: next, cursor: cur + newNodes.length };
    });
  }, [mutateActive]);

  const insertStructure = useCallback((id: StructureId) => {
    snapshot();
    setLines((prev) => {
      const arr = [...prev];
      const idx = arr.length - 1;
      const cur = arr[idx];
      const cloned = cloneNodes(cur.nodes);
      let target: Node[] | null = cloned;
      if (cursorContainer && cursorContainer.nodeId) {
        target = resolveContainer(cloned, { ...cursorContainer, sessionId: cur.id });
      }
      if (!target) target = cloned;

      const built = buildStructure(id);
      const node = built[0];
      target.splice(cursorIndex, 0, ...built);
      arr[idx] = { ...cur, nodes: cloned, status: cur.status };

      // Place cursor inside the first slot of the new structure.
      let firstSlot: string | null = null;
      switch (node.kind) {
        case "frac":    firstSlot = "num"; break;
        case "power":   firstSlot = "base"; break;
        case "root":    firstSlot = "radicand"; break;
        case "abs":     firstSlot = "body"; break;
        case "bracket": firstSlot = "body"; break;
        default: firstSlot = null;
      }
      if (firstSlot) {
        setCursorContainer({ sessionId: cur.id, nodeId: node.id, slot: firstSlot });
        setCursorIndex(0);
      } else {
        setCursorIndex(cursorIndex + built.length);
      }
      return arr;
    });
  }, [cursorContainer, cursorIndex, snapshot]);

  const insertAscii = useCallback((ascii: string) => {
    if (ascii === "__back") {
      mutateActive((nodes, cur) => {
        if (cur === 0) return { nodes, cursor: cur };
        const next = [...nodes];
        next.splice(cur - 1, 1);
        return { nodes: next, cursor: cur - 1 };
      });
      return;
    }
    if (ascii.startsWith("__")) return;
    // Natural sign normalization: a leading "+" is dropped when inserting at
    // the start of an empty line / empty slot. Matches handwritten math.
    let normalized = ascii;
    if (normalized.startsWith("+") && normalized.length > 1) {
      // Resolve the array we're inserting into to check if cursor is at the start
      // of an empty target.
      const last = lines[lines.length - 1];
      let target: Node[] = last?.nodes ?? [];
      if (cursorContainer && cursorContainer.nodeId && last) {
        const t = resolveContainer(last.nodes, { ...cursorContainer, sessionId: last.id });
        if (t) target = t;
      }
      if (cursorIndex === 0 && target.length === 0) {
        normalized = normalized.slice(1);
      }
    }
    insertNodes(asciiToNodes(normalized));
  }, [insertNodes, mutateActive, lines, cursorContainer, cursorIndex]);

  const backspace = useCallback(() => {
    mutateActive((nodes, cur) => {
      if (cur === 0) return { nodes, cursor: cur };
      const next = [...nodes];
      next.splice(cur - 1, 1);
      return { nodes: next, cursor: cur - 1 };
    });
  }, [mutateActive]);

  const moveCursor = useCallback((delta: 1 | -1) => {
    setLines((prev) => {
      const last = prev[prev.length - 1];
      let target: Node[] = last.nodes;
      if (cursorContainer && cursorContainer.nodeId) {
        const t = resolveContainer(last.nodes, { ...cursorContainer, sessionId: last.id });
        if (t) target = t;
      }
      const max = target.length;
      setCursorIndex((c) => {
        const next = c + delta;
        // Exit the slot when stepping past its boundary.
        if (next < 0 || next > max) {
          if (cursorContainer && cursorContainer.nodeId) {
            const parentInfo = findParent(last.nodes, cursorContainer.nodeId);
            if (parentInfo) {
              setCursorContainer({
                sessionId: last.id,
                nodeId: parentInfo.container.nodeId,
                slot: parentInfo.container.slot,
              });
              return parentInfo.index + (delta > 0 ? 1 : 0);
            }
          }
          return Math.max(0, Math.min(max, next));
        }
        return next;
      });
      return prev;
    });
  }, [cursorContainer]);

  // Vertical slot navigation for fraction / power.
  const moveCursorVertical = useCallback((dir: "up" | "down") => {
    if (!cursorContainer || !cursorContainer.nodeId || !cursorContainer.slot) return;
    setLines((prev) => {
      const last = prev[prev.length - 1];
      const node = (() => {
        const find = (arr: Node[]): Node | null => {
          for (const n of arr) {
            if (n.id === cursorContainer.nodeId) return n;
            // recurse
            const slots = ["num", "den", "base", "exp", "body", "radicand"] as const;
            for (const k of slots) {
              const child = (n as any)[k];
              if (Array.isArray(child)) {
                const f = find(child);
                if (f) return f;
              }
            }
          }
          return null;
        };
        return find(last.nodes);
      })();
      if (!node) return prev;
      const key = `${node.kind}_${cursorContainer.slot}`;
      const map = SLOT_PAIRS[key];
      const targetSlot = dir === "down" ? map?.down : map?.up;
      if (!targetSlot) return prev;
      setCursorContainer({ sessionId: last.id, nodeId: node.id, slot: targetSlot });
      const arr = (node as any)[targetSlot] as Node[];
      setCursorIndex(Array.isArray(arr) ? arr.length : 0);
      return prev;
    });
  }, [cursorContainer]);

  // Live validation on the active line (root only).
  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      setLines((prev) => {
        const idx = prev.length - 1;
        const cur = prev[idx];
        const previous = idx > 0 ? prev[idx - 1].nodes : question.nodes;
        const status = validateLine(cur.nodes, previous);
        if (status === cur.status) return prev;
        const next = [...prev];
        next[idx] = { ...cur, status };

        if (status === "blue") {
          const c = canonical(nodesToAscii(cur.nodes));
          const sol = c ? solveX(c) : null;
          const { lhs, rhs } = splitAtEq(cur.nodes);
          const lhsAscii = nodesToAscii(lhs).replace(/\s+/g, "");
          const rhsAscii = nodesToAscii(rhs).replace(/\s+/g, "");
          const rhsIsLiteral = /^-?\d+(\.\d+)?$/.test(rhsAscii);
          const lhsIsBareX = /^-?x$/.test(lhsAscii);
          const isFinal = !!sol && rhsIsLiteral && lhsIsBareX;
          if (isFinal) {
            setIsComplete(true);
          } else {
            next.push({ id: lid(), nodes: [], status: "empty" });
            setCursorIndex(0);
            setCursorContainer(null);
            setScatterIdx((i) => i + 1);
          }
        }
        return next;
      });
    }, 140);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [lines, question]);

  const value: Ctx = useMemo(() => ({
    question, lines, cursorIndex, cursorContainer, difficulty, isComplete,
    workspaceZoom, scatterIdx, setWorkspaceZoom, activeLineRef,
    setDifficulty: setDiff, insertAscii, insertNodes, insertStructure, backspace,
    moveCursor, moveCursorVertical, newQuestion, reset,
    undo, redo,
    canUndo: undoStackRef.current.length > 0,
    canRedo: redoStackRef.current.length > 0,
  }), [
    question, lines, cursorIndex, cursorContainer, difficulty, isComplete, workspaceZoom, scatterIdx,
    setDiff, insertAscii, insertNodes, insertStructure, backspace,
    moveCursor, moveCursorVertical, newQuestion, reset, undo, redo,
  ]);

  return <SBContext.Provider value={value}>{children}</SBContext.Provider>;
};

export const useSmartBoard = () => {
  const c = useContext(SBContext);
  if (!c) throw new Error("useSmartBoard must be used inside SmartBoardProvider");
  return c;
};

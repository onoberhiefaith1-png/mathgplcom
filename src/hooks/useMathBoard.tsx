// MathBoard global store — React context + reducer. No external deps.

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import {
  Node, mkNum, mkOp, mkVar, mkEq, mkSym, mkFrac, mkBracket, mkPower, mkRoot,
  mkAbs, mkIntegral, mkSum, mkProd, mkLim, mkDeriv, mkPartial, mkFunc, mkMixed, slotsOf,
} from "@/lib/mathboard/tokens";
import { Session, newSession, RewardKind } from "@/lib/mathboard/session";
import { Container, Cursor, resolveContainer, findParent, findNodeById } from "@/lib/mathboard/cursor";
import { equivalent } from "@/lib/mathboard/equivalence";

interface Hud {
  coins: number;
  diamonds: number;
  hearts: number;
  level: number;
  xp: number;
  /** Lifetime counters — never decrease. Used by level objectives. */
  diamondsEarned: number;
  heartsEarned: number;
  crownsEarned: number;
  coinsEarned: number;
}

export type BoardMode = "game" | "smartboard";

interface State {
  sessions: Session[];
  cursor: Cursor;
  hud: Hud;
  flying: { id: string; kind: RewardKind; fromSessionId: string }[];
  past: Session[][];
  future: Session[][];
  /** Bumped whenever a session reaches "final" status via custom validator. */
  finalCount: number;
  mode: BoardMode;
}

export type CustomValidatorResult =
  | { status: "final"; awards?: RewardKind[] }
  | { status: "equivalent" | "valid"; awards?: RewardKind[] }
  | { status: "invalid" };

export type CustomValidator = (
  studentNodes: Node[],
  sessions: Session[],
  sessionIndex: number,
) => CustomValidatorResult;

type Action =
  | { type: "INSERT_NODE"; node: Node; enterSlot?: string }
  | { type: "INSERT_NODES"; nodes: Node[] }
  | { type: "BACKSPACE" }
  | { type: "MOVE_CURSOR"; delta: 1 | -1; extend?: boolean }
  | { type: "FOCUS_CONTAINER"; container: Container; index: number }
  | { type: "SET_SELECTION"; container: Container; start: number; end: number }
  | { type: "CLEAR_SELECTION" }
  | { type: "ENTER_TOKEN"; nodeId: string; slot: string }
  | { type: "EXIT_ACTIVE_TOKEN" }
  | { type: "SUBMIT"; validator?: CustomValidator }
  | { type: "ADD_SESSION" }
  | { type: "FOCUS_SESSION"; sessionId: string }
  | { type: "AWARD"; sessionId: string; kinds: RewardKind[] }
  | { type: "FLY_DONE"; id: string }
  | { type: "RESET" }
  | { type: "LOAD_QUESTION"; nodes: Node[] }
  | { type: "SET_MODE"; mode: BoardMode }
  | { type: "UNDO" }
  | { type: "REDO" };

// Map structural-node kinds → primary slot that wraps a current selection.
const WRAP_SLOT: Partial<Record<Node["kind"], string>> = {
  frac: "num",
  mixed: "whole",
  bracket: "body",
  power: "base",
  root: "radicand",
  abs: "body",
  func: "arg",
  integral: "body",
  sum: "body",
  prod: "body",
  lim: "body",
  deriv: "body",
  partial: "body",
};

// After a wrap, where should the cursor go? "next-empty" picks the first
// remaining empty slot of the new node so the user can keep typing.
const NEXT_SLOT_AFTER_WRAP: Partial<Record<Node["kind"], string>> = {
  frac: "den",
  mixed: "num",
  power: "exp",
};

const cloneNodes = (nodes: Node[]): Node[] => JSON.parse(JSON.stringify(nodes));

const updateContainer = (
  sessions: Session[],
  c: Container,
  fn: (arr: Node[]) => Node[],
): Session[] => {
  return sessions.map((s) => {
    if (s.id !== c.sessionId) return s;
    const nodes = cloneNodes(s.nodes);
    if (c.nodeId === null) return { ...s, nodes: fn(nodes), status: s.status === "question" ? "question" : "editing" };
    // walk and replace
    const walk = (arr: Node[]): boolean => {
      for (const n of arr) {
        if (n.id === c.nodeId) {
          (n as any)[c.slot!] = fn((n as any)[c.slot!]);
          return true;
        }
        for (const k of slotsOf(n)) {
          const child = (n as any)[k];
          if (Array.isArray(child) && walk(child)) return true;
        }
      }
      return false;
    };
    walk(nodes);
    return { ...s, nodes, status: s.status === "question" ? "question" : "editing" };
  });
};

const initial: State = (() => {
  const s1 = newSession(1, "question");
  return {
    sessions: [s1],
    cursor: { container: { sessionId: s1.id, nodeId: null, slot: null }, index: 0, activeTokenId: null },
    hud: { coins: 0, diamonds: 0, hearts: 5, level: 1, xp: 0, diamondsEarned: 0, heartsEarned: 0, crownsEarned: 0, coinsEarned: 0 },
    flying: [],
    past: [],
    future: [],
    finalCount: 0,
    mode: "game",
  };
})();

const pushHistory = (state: State): State => ({
  ...state,
  past: [...state.past.slice(-50), state.sessions],
  future: [],
});

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "INSERT_NODE": {
      const c = state.cursor.container;
      const sel = state.cursor.selection;
      const wrapSlot = WRAP_SLOT[action.node.kind];
      const sameContainer =
        sel &&
        sel.container.sessionId === c.sessionId &&
        sel.container.nodeId === c.nodeId &&
        sel.container.slot === c.slot &&
        sel.end > sel.start;

      // ----- Toggle-exit: clicking same structural kind while inside it exits -----
      if (!sameContainer && state.cursor.activeTokenId && wrapSlot) {
        const session = state.sessions.find((s) => s.id === c.sessionId);
        const active = session ? findNodeById(session.nodes, state.cursor.activeTokenId) : null;
        if (active && active.kind === action.node.kind) {
          return reducer(state, { type: "EXIT_ACTIVE_TOKEN" });
        }
      }

      // ----- Wrap selection mode -----
      if (sameContainer && wrapSlot) {
        let newNodeId = action.node.id;
        let nextSlotKey: string | null = NEXT_SLOT_AFTER_WRAP[action.node.kind] ?? null;
        let upgraded = false;

        const newSessions = updateContainer(state.sessions, c, (arr) => {
          const next = [...arr];
          const taken = next.splice(sel!.start, sel!.end - sel!.start);

          // Bracket-on-bracket upgrade: selection is exactly one bracket
          // and we're inserting another bracket → mutate mode/shape, keep body.
          if (
            action.node.kind === "bracket" &&
            taken.length === 1 &&
            taken[0].kind === "bracket"
          ) {
            const existing = { ...(taken[0] as any) };
            existing.mode = (action.node as any).mode;
            existing.shape = (action.node as any).shape;
            next.splice(sel!.start, 0, existing);
            newNodeId = existing.id;
            upgraded = true;
            return next;
          }

          // Standard wrap: put taken nodes into primary slot of new node.
          const wrapped: any = { ...action.node };
          wrapped[wrapSlot] = taken;
          next.splice(sel!.start, 0, wrapped);
          return next;
        });

        // Cursor: if a "next empty slot" exists, move into it; else just past.
        const cursorContainer = nextSlotKey && !upgraded
          ? { sessionId: c.sessionId, nodeId: newNodeId, slot: nextSlotKey }
          : c;
        const cursorIndex = nextSlotKey && !upgraded ? 0 : sel!.start + 1;

        return {
          ...pushHistory(state),
          sessions: newSessions,
          cursor: {
            container: cursorContainer,
            index: cursorIndex,
            activeTokenId: newNodeId,
            selection: null,
          },
        };
      }

      // ----- Standard insert -----
      const newSessions = updateContainer(state.sessions, c, (arr) => {
        const next = [...arr];
        next.splice(state.cursor.index, 0, action.node);
        return next;
      });
      const slots = slotsOf(action.node);
      let newCursor: Cursor;
      if (slots.length > 0) {
        const slot = (action.enterSlot as any) || (slots[0] as any);
        newCursor = {
          container: { sessionId: c.sessionId, nodeId: action.node.id, slot },
          index: 0,
          activeTokenId: action.node.id,
          selection: null,
        };
      } else {
        newCursor = { ...state.cursor, index: state.cursor.index + 1, selection: null };
      }
      return { ...pushHistory(state), sessions: newSessions, cursor: newCursor };
    }
    case "INSERT_NODES": {
      const c = state.cursor.container;
      const newSessions = updateContainer(state.sessions, c, (arr) => {
        const next = [...arr];
        next.splice(state.cursor.index, 0, ...action.nodes);
        return next;
      });
      return {
        ...pushHistory(state),
        sessions: newSessions,
        cursor: { ...state.cursor, index: state.cursor.index + action.nodes.length, activeTokenId: null },
      };
    }
    case "BACKSPACE": {
      const c = state.cursor.container;
      if (state.cursor.index === 0) {
        // exit current container if inside a structural slot
        if (c.nodeId !== null) {
          const session = state.sessions.find((s) => s.id === c.sessionId);
          if (!session) return state;
          const parent = findParent(session.nodes, c.nodeId);
          if (parent) {
            return {
              ...state,
              cursor: {
                container: { ...parent.container, sessionId: c.sessionId },
                index: parent.index,
                activeTokenId: null,
              },
            };
          }
        }
        return state;
      }
      const newSessions = updateContainer(state.sessions, c, (arr) => {
        const next = [...arr];
        next.splice(state.cursor.index - 1, 1);
        return next;
      });
      return {
        ...pushHistory(state),
        sessions: newSessions,
        cursor: { ...state.cursor, index: state.cursor.index - 1 },
      };
    }
    case "MOVE_CURSOR": {
      const c = state.cursor.container;
      const session = state.sessions.find((s) => s.id === c.sessionId);
      if (!session) return state;
      const arr = resolveContainer(session.nodes, c) ?? [];
      const next = Math.max(0, Math.min(arr.length, state.cursor.index + action.delta));
      if (action.extend) {
        const sel = state.cursor.selection;
        // Anchor = the side of the existing selection NOT at current cursor,
        // or current index if no selection yet.
        const anchor = sel
          ? (sel.start === state.cursor.index ? sel.end : sel.start)
          : state.cursor.index;
        const start = Math.min(anchor, next);
        const end = Math.max(anchor, next);
        const selection = end > start
          ? { container: c, start, end }
          : null;
        return { ...state, cursor: { ...state.cursor, index: next, selection } };
      }
      return { ...state, cursor: { ...state.cursor, index: next, selection: null } };
    }
    case "SET_SELECTION": {
      const { container, start, end } = action;
      if (end <= start) {
        return { ...state, cursor: { ...state.cursor, container, index: end, selection: null, activeTokenId: null } };
      }
      return {
        ...state,
        cursor: { container, index: end, activeTokenId: null, selection: { container, start, end } },
      };
    }
    case "CLEAR_SELECTION":
      return { ...state, cursor: { ...state.cursor, selection: null } };
    case "FOCUS_CONTAINER":
      return { ...state, cursor: { container: action.container, index: action.index, activeTokenId: null, selection: null } };
    case "ENTER_TOKEN": {
      const c = state.cursor.container;
      return {
        ...state,
        cursor: {
          container: { sessionId: c.sessionId, nodeId: action.nodeId, slot: action.slot },
          index: 0,
          activeTokenId: action.nodeId,
        },
      };
    }
    case "EXIT_ACTIVE_TOKEN": {
      const id = state.cursor.activeTokenId;
      if (!id) return state;
      const session = state.sessions.find((s) => s.id === state.cursor.container.sessionId);
      if (!session) return state;
      const parent = findParent(session.nodes, id);
      if (!parent) return state;
      return {
        ...state,
        cursor: {
          container: { ...parent.container, sessionId: session.id },
          index: parent.index + 1,
          activeTokenId: null,
        },
      };
    }
    case "FOCUS_SESSION": {
      const s = state.sessions.find((x) => x.id === action.sessionId);
      if (!s) return state;
      return {
        ...state,
        cursor: {
          container: { sessionId: s.id, nodeId: null, slot: null },
          index: s.nodes.length,
          activeTokenId: null,
        },
      };
    }
    case "ADD_SESSION": {
      const idx = state.sessions.length + 1;
      const fresh = newSession(idx, "editing");
      return {
        ...state,
        sessions: [...state.sessions, fresh],
        cursor: { container: { sessionId: fresh.id, nodeId: null, slot: null }, index: 0, activeTokenId: null },
      };
    }
    case "SUBMIT": {
      const c = state.cursor.container;
      const idx = state.sessions.findIndex((s) => s.id === c.sessionId);
      if (idx === 0) {
        // First session = question. ENTER just opens next workspace.
        if (state.sessions.length > 1) {
          // Already has next session, just focus it
          const next = state.sessions[1];
          return {
            ...state,
            cursor: { container: { sessionId: next.id, nodeId: null, slot: null }, index: next.nodes.length, activeTokenId: null },
          };
        }
        const fresh = newSession(2, "editing");
        return {
          ...state,
          sessions: [...state.sessions, fresh],
          cursor: { container: { sessionId: fresh.id, nodeId: null, slot: null }, index: 0, activeTokenId: null },
        };
      }
      if (idx < 0) return state;
      const cur = state.sessions[idx];
      const prev = state.sessions[idx - 1];
      let status: Session["status"] = cur.status;
      let award: RewardKind[] = [];
      let isFinal = false;
      // Derive default award from session reward slots (already 80/20).
      const slotAwards = cur.rewards.map((r) => r.kind);
      if (action.validator) {
        const v = action.validator(cur.nodes, state.sessions, idx);
        if (v.status === "invalid") status = "invalid";
        else if (v.status === "final") {
          status = "valid";
          isFinal = true;
          award = v.awards ?? slotAwards;
        } else {
          status = "valid";
          award = v.awards ?? ["coin"];
        }
      } else {
        const res = equivalent(cur.nodes, prev.nodes);
        if (!res.ok) status = "pending";
        else if (res.equal) {
          status = "valid";
          award = ["coin"];
          if (idx % 2 === 0) award.push("diamond");
          if (idx % 3 === 0) award.push("crown");
        } else {
          status = "invalid";
        }
      }
      const newSessions = state.sessions.map((s) => (s.id === cur.id ? { ...s, status, rewards: s.rewards.map((r) => ({ ...r, unlocked: status === "valid" ? true : r.unlocked })) } : s));
      // Auto-add next session on success
      let finalSessions = newSessions;
      let newCursor = state.cursor;
      let flying = state.flying;
      let hud = state.hud;
      const isSmart = state.mode === "smartboard";
      if (status === "invalid" && !isSmart) {
        hud = { ...hud, hearts: Math.max(0, hud.hearts - 1) };
      }
      if (status === "valid") {
        const fresh = newSession(newSessions.length + 1, "editing");
        finalSessions = [...newSessions, fresh];
        newCursor = { container: { sessionId: fresh.id, nodeId: null, slot: null }, index: 0, activeTokenId: null };
        if (!isSmart) {
          flying = [
            ...flying,
            ...award.map((k) => ({ id: `f${Math.random().toString(36).slice(2)}`, kind: k, fromSessionId: cur.id })),
          ];
        }
      }
      return {
        ...state,
        sessions: finalSessions,
        cursor: newCursor,
        flying,
        hud,
        finalCount: isFinal ? state.finalCount + 1 : state.finalCount,
      };
    }
    case "AWARD":
      return state;
    case "FLY_DONE": {
      const f = state.flying.find((x) => x.id === action.id);
      if (!f) return state;
      const hud = { ...state.hud };
      if (f.kind === "coin") { hud.coins += 10; hud.coinsEarned += 1; }
      if (f.kind === "diamond") { hud.diamonds += 1; hud.diamondsEarned += 1; }
      if (f.kind === "crown") { hud.xp += 50; hud.crownsEarned += 1; if (hud.xp >= 200) { hud.level += 1; hud.xp = 0; } }
      if (f.kind === "heart") { hud.hearts = Math.min(5, hud.hearts + 1); hud.heartsEarned += 1; }
      return { ...state, hud, flying: state.flying.filter((x) => x.id !== action.id) };
    }
    case "RESET": return initial;
    case "LOAD_QUESTION": {
      const q = newSession(1, "question");
      q.nodes = action.nodes;
      const ws = newSession(2, "editing");
      return {
        ...state,
        sessions: [q, ws],
        cursor: { container: { sessionId: ws.id, nodeId: null, slot: null }, index: 0, activeTokenId: null },
        past: [],
        future: [],
        flying: [],
      };
    }
    case "SET_MODE": return { ...state, mode: action.mode };
    case "UNDO": {
      if (!state.past.length) return state;
      const prev = state.past[state.past.length - 1];
      return {
        ...state,
        sessions: prev,
        past: state.past.slice(0, -1),
        future: [state.sessions, ...state.future],
      };
    }
    case "REDO": {
      if (!state.future.length) return state;
      const next = state.future[0];
      return {
        ...state,
        sessions: next,
        past: [...state.past, state.sessions],
        future: state.future.slice(1),
      };
    }
    default: return state;
  }
};

interface Ctx {
  state: State;
  insert: (node: Node) => void;
  insertNodes: (nodes: Node[]) => void;
  type: (text: string) => void;
  backspace: () => void;
  moveCursor: (d: 1 | -1, extend?: boolean) => void;
  focusContainer: (c: Container, index: number) => void;
  setSelection: (c: Container, start: number, end: number) => void;
  clearSelection: () => void;
  enterToken: (nodeId: string, slot: string) => void;
  exitActiveToken: () => void;
  submit: () => void;
  addSession: () => void;
  focusSession: (id: string) => void;
  flyDone: (id: string) => void;
  reset: () => void;
  loadQuestion: (nodes: Node[]) => void;
  undo: () => void;
  redo: () => void;
}

const MathBoardCtx = createContext<Ctx | null>(null);

export interface MathBoardProviderProps {
  children: ReactNode;
  /** Optional custom validator. When provided, replaces the universal one for SUBMIT. */
  validator?: CustomValidator;
  /** Called whenever a session reaches "final" status via the custom validator. */
  onFinal?: () => void;
  /** "smartboard" disables coin/heart/level rewards; "game" keeps them. */
  mode?: BoardMode;
}

export const MathBoardProvider = ({ children, validator, onFinal, mode = "game" }: MathBoardProviderProps) => {
  const [state, dispatch] = useReducer(reducer, initial);
  const validatorRef = useRef(validator);
  const onFinalRef = useRef(onFinal);
  useEffect(() => { validatorRef.current = validator; }, [validator]);
  useEffect(() => { onFinalRef.current = onFinal; }, [onFinal]);
  useEffect(() => { dispatch({ type: "SET_MODE", mode }); }, [mode]);

  // Fire onFinal when finalCount increments.
  const lastFinal = useRef(state.finalCount);
  useEffect(() => {
    if (state.finalCount > lastFinal.current) {
      lastFinal.current = state.finalCount;
      onFinalRef.current?.();
    }
  }, [state.finalCount]);

  const insert = useCallback((node: Node) => dispatch({ type: "INSERT_NODE", node }), []);
  const insertNodes = useCallback((nodes: Node[]) => dispatch({ type: "INSERT_NODES", nodes }), []);
  const type = useCallback((text: string) => {
    const nodes: Node[] = [];
    for (const ch of text) {
      if (/[0-9.]/.test(ch)) nodes.push(mkNum(ch));
      else if (/[a-zA-Z]/.test(ch)) nodes.push(mkVar(ch));
      else if ("+-*/·".includes(ch)) nodes.push(mkOp(ch as any));
      else if (ch === "=") nodes.push(mkEq("="));
      else nodes.push(mkSym(ch));
    }
    if (nodes.length) dispatch({ type: "INSERT_NODES", nodes });
  }, []);
  const backspace = useCallback(() => dispatch({ type: "BACKSPACE" }), []);
  const moveCursor = useCallback((d: 1 | -1, extend?: boolean) => dispatch({ type: "MOVE_CURSOR", delta: d, extend }), []);
  const focusContainer = useCallback((c: Container, index: number) => dispatch({ type: "FOCUS_CONTAINER", container: c, index }), []);
  const setSelection = useCallback((c: Container, start: number, end: number) => dispatch({ type: "SET_SELECTION", container: c, start, end }), []);
  const clearSelection = useCallback(() => dispatch({ type: "CLEAR_SELECTION" }), []);
  const enterToken = useCallback((nodeId: string, slot: string) => dispatch({ type: "ENTER_TOKEN", nodeId, slot }), []);
  const exitActiveToken = useCallback(() => dispatch({ type: "EXIT_ACTIVE_TOKEN" }), []);
  const submit = useCallback(() => dispatch({ type: "SUBMIT", validator: validatorRef.current }), []);
  const addSession = useCallback(() => dispatch({ type: "ADD_SESSION" }), []);
  const focusSession = useCallback((id: string) => dispatch({ type: "FOCUS_SESSION", sessionId: id }), []);
  const flyDone = useCallback((id: string) => dispatch({ type: "FLY_DONE", id }), []);
  const reset = useCallback(() => dispatch({ type: "RESET" }), []);
  const loadQuestion = useCallback((nodes: Node[]) => dispatch({ type: "LOAD_QUESTION", nodes }), []);
  const undo = useCallback(() => dispatch({ type: "UNDO" }), []);
  const redo = useCallback(() => dispatch({ type: "REDO" }), []);

  const value = useMemo<Ctx>(() => ({
    state, insert, insertNodes, type, backspace, moveCursor, focusContainer,
    setSelection, clearSelection,
    enterToken, exitActiveToken, submit, addSession, focusSession, flyDone, reset, loadQuestion, undo, redo,
  }), [state, insert, insertNodes, type, backspace, moveCursor, focusContainer,
       setSelection, clearSelection,
       enterToken, exitActiveToken, submit, addSession, focusSession, flyDone, reset, loadQuestion, undo, redo]);

  return <MathBoardCtx.Provider value={value}>{children}</MathBoardCtx.Provider>;
};

export const useMathBoard = (): Ctx => {
  const v = useContext(MathBoardCtx);
  if (!v) throw new Error("useMathBoard must be inside MathBoardProvider");
  return v;
};

// Re-export factories so keyboard tabs can import from one place
export { mkNum, mkOp, mkVar, mkEq, mkSym, mkFrac, mkBracket, mkPower, mkRoot, mkAbs, mkIntegral, mkSum, mkProd, mkLim, mkDeriv, mkPartial, mkFunc, mkMixed };

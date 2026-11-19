import {
  useEffect, useMemo, useRef, useState,
  type KeyboardEvent, type PointerEvent, type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { GeometryDiagram } from "@/components/lessonnotes/GeometryDiagram";
import {
  arrangePuzzleTray, buildDiagramPuzzle, distance, gradeDiagramPuzzle, puzzleChoices, puzzleSelection, puzzleTrayOrder, puzzleGroups, puzzleJointMarks, scorePuzzleJoints, withPuzzleGroups,
  evaluatePuzzleJoints, puzzleFrame, shuffledPieces, snapAuthoredPlacement, transform, withPuzzleSelection,
  type Placement, type Position, type PuzzlePiece,
} from "@/lib/geometry/diagramPuzzle";
import type { GeometryScene } from "@/lib/geometry/scene";

const control = "rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 disabled:opacity-40";
const primary = "rounded-md bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-40";
const degrees = (value: number) => value * 180 / Math.PI;

function PuzzleWindow({ children, close }: { children: ReactNode; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  if (typeof document === "undefined") return null;
  return createPortal(
    <dialog
      ref={dialog}
      aria-label="Diagram Puzzle"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onCancel={(event) => { event.preventDefault(); event.stopPropagation(); close(); }}
      className="fixed inset-0 m-0 h-[100dvh] max-h-none w-screen max-w-none overflow-hidden bg-white p-0 text-slate-900"
    >
      {children}
    </dialog>, document.body,
  );
}

export function DiagramPuzzleEditor({
  scene, onSave, onClose, busy = false, inline = false,
}: {
  scene: GeometryScene;
  onSave: (scene: GeometryScene) => void;
  busy?: boolean;
  inline?: boolean;
  onClose: () => void;
}) {
  const choices = useMemo(() => puzzleChoices(scene), [scene]);
  const names = new Map(choices.map(({ id, name }) => [id, name]));
  const [groups, setGroups] = useState(() => {
    const saved = puzzleGroups(scene).map((group) => group.filter((id) => choices.some((item) => item.id === id))).filter((group) => group.length);
    const order = puzzleTrayOrder(scene);
    return order ? arrangePuzzleTray(saved.map((members) => ({ id: members[0], members })), order).map(({ members }) => members) : saved;
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [marks, setMarks] = useState(() => puzzleJointMarks(scene));
  const [preview, setPreview] = useState(false);
  const used = new Set(groups.flat());
  const highlighted = choices.filter((item) => used.has(item.id) || selected.includes(item.id)).map((item) => item.objectId);
  const draft = withPuzzleGroups(scene, groups, marks);
  const toggle = (id: string) => {
    if (busy || used.has(id)) return;
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };
  const content = preview ? (
    <div className="w-full">
      <button type="button" className={control} onClick={() => setPreview(false)}>Back to pieces</button>
      <DiagramPuzzlePlayer scene={draft} />
    </div>
  ) : (
    <div className="flex min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b p-3">
        <h2 className="mr-auto font-semibold">Diagram Puzzle</h2>
        <button type="button" className={control} disabled={busy} onClick={onClose}>Close editor</button>
        <button type="button" className={control} disabled={busy || !groups.length || !!selected.length} onClick={() => setPreview(true)}>Preview</button>
        {!!puzzleSelection(scene).length && (
          <button type="button" className={control} disabled={busy} onClick={() => onSave(withPuzzleSelection(scene, []))}>Remove puzzle</button>
        )}
        <button type="button" className={primary} disabled={busy || !groups.length || !!selected.length}
          onClick={() => onSave(draft)}>{busy ? "Saving…" : "Save puzzle"}</button>
      </header>
      <div className="grid min-h-0 grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(15rem,28%)]">
        <div className="grid min-h-0 place-items-center overflow-auto p-4">
          <GeometryDiagram scene={scene} crop large highlightIds={highlighted}
            onPickObject={(id) => {
              const item = choices.find((choice) => choice.objectId === id);
              if (item) toggle(item.id);
            }} />
        </div>
        <aside className="max-h-[55dvh] overflow-auto border-t p-3 md:max-h-[75dvh] md:border-l md:border-t-0">
          <label className="flex items-center justify-between gap-2 text-sm font-medium">
            Marks per correct joint
            <select className="rounded border p-1" value={marks} disabled={busy} onChange={(event) => setMarks(Number(event.target.value))}>
              {[1, 2, 3, 4, 5].map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <p className="my-2 text-sm text-slate-600">Select the objects that should move together, then add them as one piece.</p>
          <button type="button" className={primary} disabled={busy || !selected.length} onClick={() => {
            setGroups((current) => [...current, selected]);
            setSelected([]);
          }}>Add piece{selected.length ? ` (${selected.length} selected)` : ""}</button>
          <div className="my-2">
            {choices.map(({ id, name }) => (
              <label key={id} className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${used.has(id) ? "bg-amber-100" : ""}`}>
                <input type="checkbox" disabled={busy || used.has(id)} checked={used.has(id) || selected.includes(id)} onChange={() => toggle(id)} />
                <span>{name}</span>{used.has(id) && <span className="ml-auto text-xs">Used</span>}
              </label>
            ))}
          </div>
          {!!groups.length && (
            <section aria-label="Tray order" className="rounded-md border bg-slate-50 p-2">
              <button type="button" className={control} disabled={busy || groups.length < 2}
                onClick={() => setGroups(shuffledPieces(groups))}>Shuffle tray</button>
              <ol className="mt-2 space-y-2 text-sm">
                {groups.map((group) => <li key={group[0]} className="flex items-center justify-between gap-2">
                  <span>{group.map((id) => names.get(id)).join(" + ")}</span>
                  <button type="button" className="text-blue-800 underline" disabled={busy}
                    onClick={() => setGroups((current) => current.filter((item) => item !== group))}>Ungroup</button>
                </li>)}
              </ol>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
  return inline ? content : <PuzzleWindow close={busy ? () => undefined : onClose}>{content}</PuzzleWindow>;
}

function Drawing({ scene, visible, width, height }: {
  scene: GeometryScene; visible: string[]; width: number; height: number;
}) {
  const visibleIds = useMemo(() => new Set(visible), [visible]);
  return <GeometryDiagram scene={scene} visibleIds={visibleIds}
    frameW={width} frameH={height} frameMinX={24} frameMinY={24}
    explicitWidth={width} explicitHeight={height} />;
}

function PieceDrawing({ piece, pose, width, height }: {
  piece: PuzzlePiece; pose: Placement; width: number; height: number;
}) {
  const flipped = Math.cos(pose.angle) < 0;
  return (
    <g transform={`translate(${pose.x} ${pose.y}) rotate(${degrees(pose.angle)}) translate(${-piece.origin.x} ${-piece.origin.y})`}
      className={flipped ? "[&_text]:[transform-box:fill-box] [&_text]:[transform-origin:center] [&_text]:[rotate:180deg]" : undefined}>
      <Drawing scene={piece.scene} visible={piece.visible} width={width} height={height} />
    </g>
  );
}

type BoardPlacement = Placement & { owner?: string };

type Drag = {
  id: string;
  matrix: DOMMatrix;
  offset: Position;
  before?: BoardPlacement;
};

export interface PuzzleEvaluationSnapshot {
  scene: GeometryScene;
  placements: [string, BoardPlacement][];
}

export function PuzzleEvaluationView({ scene, placements }: PuzzleEvaluationSnapshot) {
  const puzzle = buildDiagramPuzzle(scene, puzzleSelection(scene));
  const poseById = new Map(placements);
  const solved = gradeDiagramPuzzle(puzzle.pieces, poseById, !!puzzle.scaffoldIds.length);
  const joints = evaluatePuzzleJoints(puzzle.pieces, poseById, solved);
  const expectedFrame = puzzleFrame(scene, puzzle, new Map());
  const actualFrame = puzzleFrame(scene, puzzle, poseById);
  const marks = puzzleJointMarks(scene);
  const earned = joints.filter((joint) => joint.correct).length;
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold">Expected diagram</p>
      <svg className="h-36 w-full rounded bg-white" role="img" aria-label="Expected diagram with joint results"
        viewBox={`${expectedFrame.left} ${expectedFrame.top} ${expectedFrame.width} ${expectedFrame.height}`}>
        <Drawing scene={scene} visible={scene.objects.map(({ id }) => id)} width={expectedFrame.width} height={expectedFrame.height} />
        {joints.map(({ index, point, correct }) => (
          <circle key={index} cx={point.x} cy={point.y} r={5} fill={correct ? "#047857" : "#facc15"} stroke="white" strokeWidth={1.5}>
            <title>{`Joint ${index + 1}: ${correct ? "correct" : "pending"}`}</title>
          </circle>
        ))}
      </svg>
      <p className="text-xs font-semibold">Student diagram</p>
      <svg className="h-36 w-full rounded bg-white" role="img" aria-label="Student reconstruction"
        viewBox={`${actualFrame.left} ${actualFrame.top} ${actualFrame.width} ${actualFrame.height}`}>
        <Drawing scene={puzzle.scene} visible={puzzle.scaffoldIds} width={actualFrame.width} height={actualFrame.height} />
        {puzzle.pieces.map((piece) => {
          const pose = poseById.get(piece.id);
          return pose ? <PieceDrawing key={piece.id} piece={piece} pose={pose}
            width={actualFrame.width} height={actualFrame.height} /> : null;
        })}
      </svg>
      <p className="text-xs">{earned} / {joints.length} correct joints · {earned * marks} / {joints.length * marks} marks</p>
    </div>
  );
}

export function DiagramPuzzlePlayer({ scene, onClose, onResize, onComplete, onEvaluate, initialPlacements }: {
  scene: GeometryScene;
  onClose?: () => void;
  onResize?: (height: number) => void;
  onComplete?: () => void;
  onEvaluate?: (snapshot: PuzzleEvaluationSnapshot) => void;
  initialPlacements?: PuzzleEvaluationSnapshot["placements"];
}) {
  const puzzle = useMemo(() => buildDiagramPuzzle(scene, puzzleSelection(scene)), [scene]);
  const [order, setOrder] = useState(() => arrangePuzzleTray(puzzle.pieces, puzzleTrayOrder(scene)));
  const [placements, setPlacements] = useState<Map<string, BoardPlacement>>(() => new Map(initialPlacements));
  const [selected, setSelected] = useState<string>();
  const [tray, setTray] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [extraSpace, setExtraSpace] = useState(0);
  const [working, setWorking] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const board = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const resizeCallback = useRef(onResize);
  resizeCallback.current = onResize;
  const observesHeight = !!onResize;
  useEffect(() => {
    const element = host.current;
    if (!element || !observesHeight) return;
    const report = () => resizeCallback.current?.(element.offsetHeight);
    report();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(report);
    observer.observe(element);
    return () => observer.disconnect();
  }, [observesHeight]);
  const { left, top, width, height } = puzzleFrame(scene, puzzle, placements, extraSpace);
  const chosen = order.find((piece) => piece.id === selected);
  const pose = chosen ? placements.get(chosen.id) : undefined;
  const remaining = order.filter((piece) => !placements.has(piece.id));

  const complete = !remaining.length && gradeDiagramPuzzle(puzzle.pieces, placements, !!puzzle.scaffoldIds.length);
  useEffect(() => {
    if (complete && !working) onComplete?.();
  }, [complete, onComplete, working]);
  const score = scorePuzzleJoints(puzzle.pieces, placements, puzzleJointMarks(scene), complete);

  const evaluate = useRef(onEvaluate);
  evaluate.current = onEvaluate;
  useEffect(() => {
    evaluate.current?.({ scene, placements: [...placements] });
  }, [scene, placements]);

  function boardPoint(event: PointerEvent, matrix: DOMMatrix): Position {
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix);
  }

  function place(id: string, placement: BoardPlacement) {
    setPlacements((current) => {
      const next = new Map(current).set(id, placement);
      const before = current.get(id);
      if (!before) return next;
      const angle = placement.angle - before.angle;
      for (const [textId, text] of current) {
        if (text.owner !== id) continue;
        next.set(textId, { ...text, ...transform(text, before, { ...placement, angle }) });
      }
      return next;
    });
    setFeedback("");
  }

  function remove(id: string) {
    setPlacements((current) => {
      const next = new Map(current);
      next.delete(id);
      for (const [textId, text] of next) {
        if (text.owner === id) next.set(textId, { ...text, owner: undefined });
      }
      return next;
    });
    setFeedback("");
  }

  function textTargets() {
    return puzzle.textSockets.flatMap((socket): { point: Position; owner?: string }[] => {
      const owner = order.find((item) => !item.isText && socket.ownerId && item.visible.includes(socket.ownerId));
      if (!owner) return [socket];
      const current = placements.get(owner.id);
      return current ? [{ point: transform(socket.point, owner.origin, current), owner: owner.id }] : [];
    });
  }

  function startMove(event: PointerEvent, piece: PuzzlePiece, current?: BoardPlacement) {
    if (event.button !== 0 || drag.current || !host.current) return;
    const screen = board.current?.getScreenCTM();
    if (!screen) return;
    event.preventDefault();
    setWorking(true);
    host.current.setPointerCapture(event.pointerId);
    setSelected(piece.id);
    const matrix = screen.inverse();
    const point = boardPoint(event, matrix);
    drag.current = {
      id: piece.id, matrix, before: current,
      offset: current ? { x: current.x - point.x, y: current.y - point.y } : { x: 0, y: 0 },
    };
  }

  function move(event: PointerEvent, finish = false) {
    const active = drag.current;
    const rect = board.current?.getBoundingClientRect();
    if (!active || !rect) return;
    const piece = order.find((item) => item.id === active.id);
    if (!piece) return;
    if (finish) drag.current = null;
    // Leaving at the tray side returns the piece. A drop beyond a yellow
    // horizontal boundary grows the drawing area instead.
    const inColumn = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top - 48;
    if (!inColumn) {
      if (finish) remove(active.id);
      return;
    }
    const point = boardPoint(event, active.matrix);
    const next = { x: point.x + active.offset.x, y: point.y + active.offset.y, angle: 0 };
    if (!finish) {
      place(active.id, next);
    } else if (piece.isText) {
      const socket = textTargets()
        .filter((item) => distance(item.point, next) < 12)
        .sort((a, b) => distance(a.point, next) - distance(b.point, next))[0];
      place(active.id, socket ? { ...next, x: socket.point.x, y: socket.point.y, owner: socket.owner } : next);
    } else {
      place(active.id, snapAuthoredPlacement(piece, order, placements, next, puzzle.scaffoldAnchors, 18));
    }
  }

  function cancelDrag() {
    const active = drag.current;
    drag.current = null;
    if (!active) return;
    if (active.before) place(active.id, active.before);
    else remove(active.id);
    setWorking(false);
  }

  function keyboard(event: KeyboardEvent<SVGSVGElement>) {
    if (!chosen || !pose) return;
    const key = event.key;
    if (key === "Delete" || key === "Backspace") {
      event.preventDefault();
      event.stopPropagation();
      remove(chosen.id);
      return;
    }
    const direction: Record<string, Position> = {
      ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
    };
    const offset = direction[key];
    if (offset) {
      event.preventDefault();
      event.stopPropagation();
      const step = event.shiftKey ? 10 : 1;
      place(chosen.id, { ...pose, owner: undefined, x: pose.x + offset.x * step, y: pose.y + offset.y * step });
    }
  }

  const content = (
      <div ref={host}
        className={onClose ? "flex h-full flex-col" : "flex w-full min-w-0 flex-col text-slate-900"}
        onPointerDown={(event) => { event.stopPropagation(); setWorking(true); }}
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setWorking(false); }}
        onClick={(event) => event.stopPropagation()}
        onPointerMove={(event) => move(event)}
        onPointerUp={(event) => { move(event, true); drag.current = null; setWorking(false); }}
        onLostPointerCapture={cancelDrag}
        onPointerCancel={() => { cancelDrag(); setWorking(false); }}>
        <header className="flex flex-wrap items-center gap-2 border-b p-3">
          {onClose && <button type="button" className={control} onClick={onClose}>Close</button>}
          <h2 className="mr-auto font-semibold">Diagram Puzzle</h2>
          <output aria-live="polite" className="text-sm tabular-nums">
            {score.earned} / {score.available} marks · {score.correct} / {score.total} joints
          </output>
          <button type="button" className={control} onClick={() => setExtraSpace((space) => space + 120)}>More space</button>
          <button type="button" className={control} aria-expanded={tray} onClick={() => setTray(!tray)}>
            {tray ? "Hide tray" : "Show tray"} ({remaining.length})
          </button>
          <button type="button" className={control} onClick={() => {
            setPlacements(new Map()); setSelected(undefined); setFeedback("");
            setExtraSpace(0);
            setOrder(arrangePuzzleTray(puzzle.pieces, puzzleTrayOrder(scene)));
          }}>Reset</button>
          <button type="button" className={primary} disabled={!!remaining.length || !order.length} onClick={() => {
            setFeedback(complete
              ? "Correct. You reconstructed the diagram."
              : "Keep going. Check the connections, angles and label positions.");
          }}>Check</button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
            <p className="px-3 py-2 text-xs text-slate-600">Drag pieces into place. Each piece keeps its original angle.</p>
            <svg ref={board} tabIndex={0} aria-label="Construction area. Use arrow keys to move the selected piece."
              className={`min-h-0 w-full flex-1 touch-none overflow-hidden border-y-2 focus-visible:outline-blue-600 ${working ? "border-yellow-400" : "border-transparent"}`}
              style={{ height: Math.max(280, Math.round(height * 0.72)), flex: "none" }}
              viewBox={`${left} ${top} ${width} ${height}`} onKeyDown={keyboard}
              onPointerDown={(event) => {
                if (!(event.target as Element).closest("[data-puzzle-piece]")) setSelected(undefined);
              }}>
              <rect x={left} y={top} width={width} height={height} fill="transparent" />
              <g pointerEvents="none">
                <Drawing scene={puzzle.scene} visible={puzzle.scaffoldIds} width={width} height={height} />
              </g>
              {order.filter((piece) => piece.id !== selected).concat(chosen ? [chosen] : []).map((piece) => {
                const current = placements.get(piece.id);
                if (!current) return null;
                const anchors = piece.anchors.map((point) => transform(point, piece.origin, current));
                return (
                  <g key={piece.id} data-puzzle-piece className="cursor-grab active:cursor-grabbing"
                    onPointerDown={(event) => startMove(event, piece, current)}>
                    <PieceDrawing piece={piece} pose={current} width={width} height={height} />
                    {anchors.length === 2 && (
                      <line x1={anchors[0].x} y1={anchors[0].y} x2={anchors[1].x} y2={anchors[1].y}
                        stroke="transparent" strokeWidth={18} />
                    )}
                    <circle cx={current.x} cy={current.y} r={10} fill="transparent" />
                  </g>
                );
              })}
            </svg>
            <div className="flex min-h-11 flex-wrap items-center gap-2 border-t px-3 py-1">
              {chosen && pose && (
                <>
                  <span className="text-sm font-medium">{chosen.name}</span>
                  <button type="button" className={control} onClick={() => remove(chosen.id)}>Return to tray</button>
                </>
              )}
              <p role="status" className="text-sm font-medium">{feedback}</p>
            </div>
          </main>
          {tray && (
            <aside aria-label="Puzzle tray" className="max-h-[32dvh] shrink-0 overflow-auto border-t bg-white/85 p-2 md:max-h-[29rem] md:w-56 md:border-l md:border-t-0 lg:w-64">
              <h3 className="mb-2 font-semibold">Puzzle tray</h3>
              {!remaining.length && <p className="text-sm text-slate-600">All pieces are on the board.</p>}
              <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
                {remaining.map((piece) => {
                  const radius = piece.previewRadius;
                  const round = piece.scene.objects.some((object) =>
                    piece.visible.includes(object.id) && (object.type === "circle" || object.type === "arc"));
                  const halfHeight = round ? radius : Math.min(radius, Math.max(18,
                    ...piece.variants[0].map((point) => Math.abs(point.y - piece.origin.y) + 14)));
                  return (
                    <button type="button" key={piece.id} className="min-w-0 touch-none rounded-lg border bg-white p-2 text-xs hover:border-blue-600"
                      aria-label={`Place ${piece.name}`}
                      onPointerDown={(event) => startMove(event, piece)}
                      onClick={(event) => {
                        if (event.detail !== 0 || drag.current) return;
                        setSelected(piece.id);
                        place(piece.id, { x: left + width / 2, y: top + height / 2, angle: 0 });
                        board.current?.focus();
                      }}>
                      <svg viewBox={`${-radius} ${-halfHeight} ${radius * 2} ${halfHeight * 2}`}
                        className="h-14 w-full overflow-hidden" aria-hidden="true">
                        <PieceDrawing piece={piece} pose={{ x: 0, y: 0, angle: 0 }} width={width} height={height} />
                      </svg>
                      <span className="block break-words">{piece.name}</span>
                    </button>
                  );
                })}
              </div>
            </aside>
          )}
        </div>
      </div>
  );
  return onClose ? <PuzzleWindow close={onClose}>{content}</PuzzleWindow> : content;
}

export function DiagramWritingSection({
  children, top, onHeight, reveal = false,
}: {
  children: ReactNode;
  top: number;
  onHeight: (height: number) => void;
  reveal?: boolean;
}) {
  const section = useRef<HTMLElement>(null);
  const callback = useRef(onHeight);
  callback.current = onHeight;
  useEffect(() => {
    const element = section.current;
    if (!element) return;
    const measure = () => callback.current(element.offsetHeight);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!reveal) return;
    const frame = requestAnimationFrame(() => section.current?.scrollIntoView?.({ block: "nearest" }));
    return () => cancelAnimationFrame(frame);
  }, [reveal]);
  return <section ref={section} aria-label="Lesson diagrams" style={{ top }}
    className="pointer-events-none absolute inset-x-0 z-[46] mx-auto w-[96%] max-w-5xl space-y-3">{children}</section>;
}

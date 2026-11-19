import {
  useEffect, useMemo, useRef, useState,
  type KeyboardEvent, type PointerEvent, type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { GeometryDiagram } from "@/components/lessonnotes/GeometryDiagram";
import {
  buildDiagramPuzzle, distance, gradeDiagramPuzzle, puzzleChoices, puzzleSelection,
  shuffledPieces, snapPlacement, snapRotation, transform, withPuzzleSelection,
  type Placement, type Position, type PuzzlePiece,
} from "@/lib/geometry/diagramPuzzle";
import type { GeometryScene } from "@/lib/geometry/scene";

const control = "rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 disabled:opacity-40";
const primary = "rounded-md bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-40";
const degrees = (value: number) => value * 180 / Math.PI;
const rad = (value: number) => value * Math.PI / 180;
const bearing = (a: Position, b: Position) => Math.atan2(b.y - a.y, b.x - a.x);

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
      onCancel={(event) => { event.preventDefault(); event.stopPropagation(); close(); }}
      className="fixed inset-0 m-0 h-[100dvh] max-h-none w-screen max-w-none overflow-hidden bg-white p-0 text-slate-900"
    >
      {children}
    </dialog>, document.body,
  );
}

export function DiagramPuzzleEditor({
  scene, onSave, onClose,
}: {
  scene: GeometryScene;
  onSave: (scene: GeometryScene) => void;
  onClose: () => void;
}) {
  const choices = useMemo(() => puzzleChoices(scene), [scene]);
  const [selected, setSelected] = useState(() => puzzleSelection(scene));
  const [preview, setPreview] = useState(false);
  const selectedIds = choices.filter((item) => selected.includes(item.id)).map((item) => item.id);
  const highlighted = choices.filter((item) => selected.includes(item.id)).map((item) => item.objectId);
  const toggle = (id: string) => setSelected((current) =>
    current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  if (preview) {
    return <DiagramPuzzlePlayer scene={withPuzzleSelection(scene, selectedIds)} onClose={() => setPreview(false)} />;
  }
  return (
    <PuzzleWindow close={onClose}>
      <div className="flex h-full flex-col">
        <header className="flex flex-wrap items-center gap-2 border-b p-3">
          <button type="button" className={control} onClick={onClose}>Close</button>
          <h2 className="mr-auto font-semibold">Diagram Puzzle</h2>
          <button type="button" className={control} disabled={!selectedIds.length} onClick={() => setPreview(true)}>Preview</button>
          {!!puzzleSelection(scene).length && (
            <button type="button" className={control} onClick={() => onSave(withPuzzleSelection(scene, []))}>Remove puzzle</button>
          )}
          <button type="button" className={primary} disabled={!selectedIds.length}
            onClick={() => onSave(withPuzzleSelection(scene, selectedIds))}>Save puzzle</button>
        </header>
        <div className="grid min-h-0 flex-1 grid-rows-[1fr_auto] md:grid-cols-[minmax(0,1fr)_minmax(15rem,23%)] md:grid-rows-1">
          <div className="grid min-h-0 place-items-center overflow-auto p-6">
            <GeometryDiagram scene={scene} crop large highlightIds={highlighted}
              onPickObject={(id) => {
                const item = choices.find((choice) => choice.objectId === id);
                if (item) toggle(item.id);
              }} />
          </div>
          <aside className="max-h-[40dvh] overflow-auto border-t p-4 md:max-h-none md:border-l md:border-t-0">
            <h3 className="font-semibold">Extract pieces</h3>
            <p className="mb-3 text-sm text-slate-600">Select objects or extract their labels and values separately.</p>
            <div className="grid gap-1">
              {choices.map((item) => (
                <label key={item.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 hover:bg-slate-100">
                  <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} />
                  <span>{item.name}</span>
                  {item.id !== JSON.stringify([item.objectId]) && (
                    <span className="ml-auto text-xs text-slate-500">Attached text</span>
                  )}
                </label>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </PuzzleWindow>
  );
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

type Drag =
  | { id: string; kind: "move"; offset: Position; angle: number }
  | { id: string; kind: "rotate"; pivot: Position; pose: Placement; start: number };

export function DiagramPuzzlePlayer({ scene, onClose }: { scene: GeometryScene; onClose: () => void }) {
  const puzzle = useMemo(() => buildDiagramPuzzle(scene, puzzleSelection(scene)), [scene]);
  const [order, setOrder] = useState(() => shuffledPieces(puzzle.pieces));
  const [placements, setPlacements] = useState<Map<string, BoardPlacement>>(() => new Map());
  const [selected, setSelected] = useState<string>();
  const [tray, setTray] = useState(true);
  const [feedback, setFeedback] = useState("");
  const host = useRef<HTMLDivElement>(null);
  const board = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const allPoints = [...puzzle.scaffoldAnchors, ...puzzle.pieces.flatMap((piece) => piece.variants[0])];
  const left = Math.min(0, ...allPoints.map((point) => point.x)) - 36;
  const top = Math.min(0, ...allPoints.map((point) => point.y)) - 36;
  const width = Math.max(scene.bounds.width, ...allPoints.map((point) => point.x)) + 36 - left;
  const height = Math.max(scene.bounds.height, ...allPoints.map((point) => point.y)) + 36 - top;
  const chosen = order.find((piece) => piece.id === selected);
  const pose = chosen ? placements.get(chosen.id) : undefined;
  const remaining = order.filter((piece) => !placements.has(piece.id));

  function boardPoint(event: PointerEvent): Position | null {
    const matrix = board.current?.getScreenCTM();
    return matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : null;
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

  function targets(piece: PuzzlePiece) {
    return [
      ...puzzle.scaffoldAnchors,
      ...order.flatMap((item) => {
        const current = item.id !== piece.id && placements.get(item.id);
        return current ? item.anchors.map((point) => transform(point, item.origin, current)) : [];
      }),
    ];
  }

  function textTargets() {
    return puzzle.textSockets.flatMap((socket): { point: Position; owner?: string }[] => {
      const owner = order.find((item) => !item.isText && socket.ownerId && item.visible.includes(socket.ownerId));
      if (!owner) return [socket];
      const current = placements.get(owner.id);
      return current ? [{ point: transform(socket.point, owner.origin, current), owner: owner.id }] : [];
    });
  }

  function startMove(event: PointerEvent, piece: PuzzlePiece, current?: Placement) {
    if (event.button !== 0 || drag.current) return;
    const point = boardPoint(event);
    if (!point || !host.current) return;
    event.preventDefault();
    host.current.setPointerCapture(event.pointerId);
    setSelected(piece.id);
    const angle = current?.angle ?? (piece.canRotate ? rad(30 + order.indexOf(piece) % 7 * 30) : 0);
    drag.current = {
      id: piece.id, kind: "move", angle,
      offset: current ? { x: current.x - point.x, y: current.y - point.y } : { x: 0, y: 0 },
    };
    if (!current) place(piece.id, { x: point.x, y: point.y, angle });
  }

  function move(event: PointerEvent, finish = false) {
    const active = drag.current;
    const point = boardPoint(event);
    if (!active || !point) return;
    const piece = order.find((item) => item.id === active.id);
    if (!piece) return;
    if (finish) drag.current = null;
    if (finish && active.kind === "move" && (
      point.x < left || point.y < top || point.x > left + width || point.y > top + height ||
      !board.current?.contains(document.elementFromPoint(event.clientX, event.clientY))
    )) {
      remove(active.id);
      return;
    }
    if (active.kind === "rotate") {
      const delta = bearing(active.pivot, point) - active.start;
      const center = transform(active.pose, active.pivot, { ...active.pivot, angle: delta });
      const next = { ...center, angle: active.pose.angle + delta };
      place(active.id, finish ? snapRotation(piece, next, active.pivot, targets(piece), 12) : next);
      return;
    }
    const next = { x: point.x + active.offset.x, y: point.y + active.offset.y, angle: active.angle };
    if (!finish) {
      place(active.id, next);
    } else if (piece.isText) {
      const socket = textTargets()
        .filter((item) => distance(item.point, next) < 12)
        .sort((a, b) => distance(a.point, next) - distance(b.point, next))[0];
      place(active.id, socket ? { ...next, x: socket.point.x, y: socket.point.y, owner: socket.owner } : next);
    } else {
      place(active.id, snapPlacement(piece, next, targets(piece), 12));
    }
  }

  const worldAnchors = chosen && pose
    ? chosen.anchors.map((point) => transform(point, chosen.origin, pose))
    : [];
  const connected = chosen ? targets(chosen) : [];
  const pivot = pose && (worldAnchors.find((point) => connected.some((target) => distance(point, target) < 1)) ?? pose);
  const handle = pivot && [...worldAnchors].sort((a, b) => distance(b, pivot) - distance(a, pivot))[0];

  function rotate(amount: number) {
    if (!chosen || !pose || !pivot || !chosen.canRotate) return;
    const center = transform(pose, pivot, { ...pivot, angle: amount });
    place(chosen.id, { ...center, angle: pose.angle + amount });
  }

  function keyboard(event: KeyboardEvent<SVGSVGElement>) {
    if (!chosen || !pose) return;
    const key = event.key;
    if (key === "[" || key === "]") {
      event.preventDefault();
      rotate(rad(key === "[" ? -5 : 5));
    }
    const direction: Record<string, Position> = {
      ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
    };
    const offset = direction[key];
    if (offset) {
      event.preventDefault();
      const step = event.shiftKey ? 10 : 1;
      place(chosen.id, { ...pose, owner: undefined, x: pose.x + offset.x * step, y: pose.y + offset.y * step });
    }
  }

  return (
    <PuzzleWindow close={onClose}>
      <div ref={host} className="flex h-full flex-col"
        onPointerMove={(event) => move(event)}
        onPointerUp={(event) => { move(event, true); drag.current = null; }}
        onLostPointerCapture={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}>
        <header className="flex flex-wrap items-center gap-2 border-b p-3">
          <button type="button" className={control} onClick={onClose}>Close</button>
          <h2 className="mr-auto font-semibold">Diagram Puzzle</h2>
          <button type="button" className={control} aria-expanded={tray} onClick={() => setTray(!tray)}>
            {tray ? "Hide tray" : "Show tray"} ({remaining.length})
          </button>
          <button type="button" className={control} onClick={() => {
            setPlacements(new Map()); setSelected(undefined); setFeedback("");
            setOrder(shuffledPieces(puzzle.pieces));
          }}>Reset</button>
          <button type="button" className={primary} disabled={!!remaining.length || !order.length} onClick={() => {
            setFeedback(gradeDiagramPuzzle(puzzle.pieces, placements, !!puzzle.scaffoldIds.length)
              ? "Correct. You reconstructed the diagram."
              : "Keep going. Check the connections, angles and label positions.");
          }}>Check</button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
            <p className="px-3 py-2 text-xs text-slate-600">Drag pieces onto the board. Select a piece and drag its blue handle to rotate it.</p>
            <svg ref={board} tabIndex={0} aria-label="Construction area. Use arrow keys to move the selected piece and bracket keys to rotate."
              className="min-h-0 w-full flex-1 touch-none overflow-hidden focus-visible:outline-blue-600"
              viewBox={`${left} ${top} ${width} ${height}`} onKeyDown={keyboard}
              onPointerDown={(event) => {
                if (!(event.target as Element).closest("[data-puzzle-piece], [data-puzzle-handle]")) setSelected(undefined);
              }}>
              <rect x={left} y={top} width={width} height={height} fill="#fff" />
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
              {chosen?.canRotate && pivot && handle && pose && (
                <g data-puzzle-handle>
                  <line x1={pivot.x} y1={pivot.y} x2={handle.x} y2={handle.y}
                    stroke="#93c5fd" strokeDasharray="4 4" pointerEvents="none" />
                  <circle cx={handle.x} cy={handle.y} r={9} fill="#2563eb" stroke="white" strokeWidth={2}
                    className="cursor-crosshair" onPointerDown={(event) => {
                      const point = boardPoint(event);
                      if (!point || event.button !== 0 || !host.current || drag.current) return;
                      event.preventDefault();
                      host.current.setPointerCapture(event.pointerId);
                      drag.current = { id: chosen.id, kind: "rotate", pivot, pose, start: bearing(pivot, point) };
                    }} />
                </g>
              )}
            </svg>
            <div className="flex min-h-11 flex-wrap items-center gap-2 border-t px-3 py-1">
              {chosen && pose && (
                <>
                  <span className="text-sm font-medium">{chosen.name}</span>
                  {chosen.canRotate && (
                    <>
                      <button type="button" className={control} onClick={() => rotate(rad(-5))}>Rotate left</button>
                      <button type="button" className={control} onClick={() => rotate(rad(5))}>Rotate right</button>
                    </>
                  )}
                  <button type="button" className={control} onClick={() => remove(chosen.id)}>Return to tray</button>
                </>
              )}
              <p role="status" className="text-sm font-medium">{feedback}</p>
            </div>
          </main>
          {tray && (
            <aside aria-label="Puzzle tray" className="max-h-[34dvh] shrink-0 overflow-auto border-t bg-slate-50 p-3 md:max-h-none md:w-[23%] md:min-w-44 md:border-l md:border-t-0">
              <h3 className="mb-2 font-semibold">Puzzle tray</h3>
              {!remaining.length && <p className="text-sm text-slate-600">All pieces are on the board.</p>}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-2">
                {remaining.map((piece) => {
                  const radius = piece.previewRadius;
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
                      <svg viewBox={`${-radius} ${-radius} ${radius * 2} ${radius * 2}`}
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
    </PuzzleWindow>
  );
}

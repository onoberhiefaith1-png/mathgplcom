// STUDENT GAME MAP — the journey through this Class + Game's Levels.
//
// Every assigned Question is one Level: a destination on a continuous path.
// This is presentation only: tapping a node asks the existing Game runtime to
// open that Level. It is never a second game engine.

import { Check, Lock, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LevelMapStyle } from "@/lib/slate/gameAssignments";

export interface LevelMapNode {
  id: string;
  title: string;
  /** Best marks the student holds for this Level. */
  earned: number;
  total: number;
  completed: boolean;
  unlocked: boolean;
}

interface Props {
  nodes: LevelMapNode[];
  currentIndex: number;
  style?: LevelMapStyle;
  onOpen: (index: number) => void;
  onClose: () => void;
}

/** Winding path: node N sits a little left or right of centre. */
const offsetFor = (index: number) => {
  const wave = [0, 1, 2, 1, 0, -1, -2, -1];
  return wave[index % wave.length] * 11;
};

export const GameLevelMap = ({
  nodes, currentIndex, style = "path", onOpen, onClose,
}: Props) => (
  <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm">
    <header className="flex items-center justify-between border-b border-border px-5 py-3">
      <div>
        <h2 className="text-lg font-semibold">Your journey</h2>
        <p className="text-xs text-muted-foreground">
          Level {Math.min(currentIndex + 1, nodes.length)} of {nodes.length}
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
      >
        Close
      </button>
    </header>

    <div className="flex-1 overflow-auto px-5 py-8">
      {style === "art" ? (
        <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {nodes.map((node, index) => (
            <LevelCard
              key={node.id}
              node={node}
              index={index}
              current={index === currentIndex}
              onOpen={onOpen}
            />
          ))}
        </div>
      ) : (
        <ol className="relative mx-auto flex max-w-xl flex-col items-center gap-10">
          <span
            aria-hidden
            className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-gradient-to-b from-primary/50 via-primary/25 to-border"
          />
          {nodes.map((node, index) => (
            <li
              key={node.id}
              className="relative z-10"
              style={{ transform: `translateX(${offsetFor(index)}%)` }}
            >
              <LevelNode
                node={node}
                index={index}
                current={index === currentIndex}
                onOpen={onOpen}
              />
            </li>
          ))}
        </ol>
      )}
      {nodes.length === 0 && (
        <p className="py-16 text-center text-sm text-muted-foreground">
          No Levels have been added to this Game yet.
        </p>
      )}
    </div>
  </div>
);

const statusRing = (node: LevelMapNode, current: boolean) =>
  !node.unlocked
    ? "border-border bg-muted text-muted-foreground"
    : node.completed
      ? "border-primary bg-primary/15 text-primary"
      : current
        ? "border-primary bg-background text-foreground ring-4 ring-primary/25"
        : "border-border bg-card text-foreground";

const LevelNode = ({
  node, index, current, onOpen,
}: { node: LevelMapNode; index: number; current: boolean; onOpen: (i: number) => void }) => (
  <button
    type="button"
    disabled={!node.unlocked}
    onClick={() => onOpen(index)}
    className="flex flex-col items-center gap-2 disabled:cursor-not-allowed"
  >
    <span
      className={cn(
        "flex h-20 w-20 flex-col items-center justify-center rounded-full border-2 shadow-sm transition-transform",
        node.unlocked && "hover:scale-105",
        statusRing(node, current),
      )}
    >
      {!node.unlocked ? (
        <Lock className="h-5 w-5" />
      ) : node.completed ? (
        <Check className="h-6 w-6" />
      ) : (
        <Play className="h-5 w-5" />
      )}
      <span className="mt-1 text-[11px] font-semibold uppercase tracking-wide">
        Level {index + 1}
      </span>
    </span>
    <span className="max-w-[12rem] truncate text-xs text-muted-foreground">{node.title}</span>
    <span className="text-[11px] text-muted-foreground">
      {node.earned}/{node.total} marks
    </span>
  </button>
);

const LevelCard = ({
  node, index, current, onOpen,
}: { node: LevelMapNode; index: number; current: boolean; onOpen: (i: number) => void }) => (
  <button
    type="button"
    disabled={!node.unlocked}
    onClick={() => onOpen(index)}
    className={cn(
      "flex flex-col gap-2 rounded-xl border-2 p-4 text-left shadow-sm transition-transform disabled:cursor-not-allowed",
      node.unlocked && "hover:scale-[1.02]",
      statusRing(node, current),
    )}
  >
    <span className="text-xs font-semibold uppercase tracking-wide">Level {index + 1}</span>
    <span className="line-clamp-2 text-sm font-medium text-foreground">{node.title}</span>
    <span className="flex items-center gap-2 text-xs">
      {!node.unlocked ? <Lock className="h-3.5 w-3.5" /> : node.completed ? <Check className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      {node.earned}/{node.total} marks
    </span>
  </button>
);

export default GameLevelMap;

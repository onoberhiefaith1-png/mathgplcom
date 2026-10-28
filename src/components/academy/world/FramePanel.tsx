/**
 * FRAME CONTENT PANEL — what a student sees after clicking a frame on the wall.
 *
 * The frame is a portal, not the content: this panel only lists the shortcuts
 * the teacher hung on it, and picking one opens the existing course, assignment,
 * adventure or game exactly as it already works. Closing the panel puts the
 * student back where they were standing.
 */
import { BookOpen, Compass, Gamepad2, ClipboardList, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AcademyProduct, AcademyProductKind } from "@/lib/academy/types";
import type { BuildingFrame, FrameLink } from "@/lib/building/frames";

const KIND_ICON: Record<AcademyProductKind, typeof BookOpen> = {
  course: BookOpen,
  assessment: ClipboardList,
  adventure: Compass,
  game: Gamepad2,
};

const KIND_LABEL: Record<AcademyProductKind, string> = {
  course: "Course",
  assessment: "Assignment",
  adventure: "Adventure",
  game: "Game",
};

export interface FramePanelProps {
  frame: BuildingFrame;
  links: FrameLink[];
  catalogue: AcademyProduct[];
  onOpen: (kind: AcademyProductKind, id: string) => void;
  onClose: () => void;
}

const FramePanel = ({ frame, links, catalogue, onOpen, onClose }: FramePanelProps) => {
  const titleOf = (link: FrameLink) =>
    catalogue.find((p) => p.kind === link.content_kind && p.id === link.content_id)?.title ??
    `${KIND_LABEL[link.content_kind]} (unavailable)`;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/70 p-4 backdrop-blur">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card/95 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">On this wall</p>
            <h2 className="text-lg font-semibold">{frame.name}</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close frame">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          {links.length === 0 && (
            <p className="rounded-lg border border-dashed border-border/60 px-3 py-6 text-center text-sm text-muted-foreground">
              Nothing has been placed behind this frame yet.
            </p>
          )}
          {links.map((link) => {
            const Icon = KIND_ICON[link.content_kind];
            return (
              <button
                key={link.id}
                type="button"
                onClick={() => onOpen(link.content_kind, link.content_id)}
                className="flex w-full items-center gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-3 text-left transition hover:border-primary/60 hover:bg-primary/5"
              >
                <Icon className="h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{titleOf(link)}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {KIND_LABEL[link.content_kind]}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <Button variant="outline" className="mt-4 w-full" onClick={onClose}>
          Back to the room
        </Button>
      </div>
    </div>
  );
};

export default FramePanel;

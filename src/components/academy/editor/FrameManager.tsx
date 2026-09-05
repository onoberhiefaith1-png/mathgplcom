/**
 * FRAMES — the teacher's control for the wall-mounted shortcut boards.
 *
 * A frame is placed on a chosen wall of a chosen hallway or room, given a name,
 * then filled with LINKS to work that already exists. Nothing is copied here, so
 * removing a link or the whole frame never touches the course, assignment,
 * adventure or game itself.
 */
import { useMemo, useState } from "react";
import { Frame as FrameIcon, Loader2, Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addFrameLink,
  createFrame,
  deleteFrame,
  removeFrameLink,
  updateFrame,
  FRAME_DESIGNS,
  FRAME_MAX_WIDTH,
  FRAME_MIN_WIDTH,
  FRAME_WALL_LABEL,
  frameDesign,
  type BuildingFrame,
  type FrameDesignKey,
  type FrameLink,
  type FrameWall,
} from "@/lib/building/frames";
import type { AcademyProduct, AcademyProductKind } from "@/lib/academy/types";
import type { BuildingClassroom, BuildingWalkway } from "@/lib/building/types";

const WALLS: FrameWall[] = ["leftWall", "rightWall", "endWall"];

interface FrameManagerProps {
  buildingId: string;
  frames: BuildingFrame[];
  frameLinks: FrameLink[];
  walkways: BuildingWalkway[];
  classrooms: BuildingClassroom[];
  catalogue: AcademyProduct[];
  selectedFrameId: string | null;
  onSelectFrame: (id: string | null) => void;
  /** Reloads the building so the 3D view matches the panel. */
  onChanged: () => Promise<void>;
}

const SliderRow = ({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) => (
  <label className="block text-[11px] text-muted-foreground">
    <span className="mb-1 flex items-center justify-between">
      {label}
      <span className="tabular-nums text-foreground">{value.toFixed(2)}</span>
    </span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-primary"
    />
  </label>
);

const FrameManager = ({
  buildingId,
  frames,
  frameLinks,
  walkways,
  classrooms,
  catalogue,
  selectedFrameId,
  onSelectFrame,
  onChanged,
}: FrameManagerProps) => {
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [design, setDesign] = useState<FrameDesignKey>("courses");
  const [place, setPlace] = useState<string>("");
  const [wall, setWall] = useState<FrameWall>("leftWall");
  const [name, setName] = useState("");
  const [pickKind, setPickKind] = useState<AcademyProductKind>("course");
  const [pickId, setPickId] = useState("");

  const places = useMemo(
    () => [
      ...walkways.map((w) => ({ value: `hall:${w.id}`, label: `Hallway · ${w.name}` })),
      ...classrooms.map((c) => ({ value: `room:${c.id}`, label: `Room · ${c.name}` })),
    ],
    [walkways, classrooms],
  );

  const linksOf = (frameId: string) =>
    frameLinks.filter((l) => l.frame_id === frameId).sort((a, b) => a.position - b.position);

  const titleOf = (kind: AcademyProductKind, id: string) =>
    catalogue.find((p) => p.kind === kind && p.id === id)?.title ?? "Unavailable item";

  const placeLabel = (frame: BuildingFrame) =>
    frame.walkway_id
      ? `Hallway · ${walkways.find((w) => w.id === frame.walkway_id)?.name ?? "Unknown"}`
      : `Room · ${classrooms.find((c) => c.id === frame.classroom_id)?.name ?? "Unknown"}`;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  const submitNew = async () => {
    const target = place || places[0]?.value;
    if (!target) return;
    const [kind, id] = target.split(":");
    await run(async () => {
      const created = await createFrame({
        buildingId,
        walkwayId: kind === "hall" ? id : null,
        classroomId: kind === "room" ? id : null,
        wall,
        design,
        name: name.trim() || frameDesign(design).label,
      });
      onSelectFrame(created.id);
      setAdding(false);
      setName("");
    });
  };

  const options = catalogue.filter((p) => p.kind === pickKind);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          Hang a frame on a wall and link work that already exists to it.
        </p>
        <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)} disabled={busy}>
          {adding ? <X className="mr-1.5 h-3.5 w-3.5" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
          {adding ? "Cancel" : "Add frame"}
        </Button>
      </div>

      {adding && (
        <div className="space-y-3 rounded-xl border border-border/60 bg-background/50 p-3">
          <div className="grid grid-cols-3 gap-2">
            {FRAME_DESIGNS.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setDesign(d.key)}
                className={`overflow-hidden rounded-lg border text-left transition ${
                  design === d.key ? "border-primary ring-1 ring-primary/50" : "border-border/60"
                }`}
              >
                <img src={d.url} alt={d.label} className="aspect-square w-full object-cover" />
                <span className="block truncate px-1.5 py-1 text-[10px]">{d.label}</span>
              </button>
            ))}
          </div>

          <label className="block text-[11px] text-muted-foreground">
            Where does it hang?
            <select
              value={place || places[0]?.value || ""}
              onChange={(e) => setPlace(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
            >
              {places.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap gap-1.5">
            {WALLS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWall(w)}
                className={`min-h-[32px] rounded-full px-3 text-[11px] font-semibold ${
                  wall === w
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {FRAME_WALL_LABEL[w]}
              </button>
            ))}
          </div>

          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Frame name, e.g. This week's assignments"
            className="h-9 text-xs"
          />

          <Button size="sm" className="w-full" onClick={() => void submitNew()} disabled={busy || places.length === 0}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FrameIcon className="mr-2 h-4 w-4" />}
            Hang the frame
          </Button>
        </div>
      )}

      {frames.length === 0 && !adding && (
        <p className="rounded-lg border border-dashed border-border/60 px-3 py-6 text-center text-[11px] text-muted-foreground">
          No frames yet.
        </p>
      )}

      {frames.map((frame) => {
        const open = selectedFrameId === frame.id;
        const links = linksOf(frame.id);
        return (
          <div key={frame.id} className="rounded-xl border border-border/60 bg-card/40 p-3">
            <button
              type="button"
              onClick={() => onSelectFrame(open ? null : frame.id)}
              className="flex w-full items-center gap-2 text-left"
            >
              <img
                src={frameDesign(frame.design).url}
                alt=""
                className="h-9 w-9 shrink-0 rounded border border-border/50 object-cover"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">{frame.name}</span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  {placeLabel(frame)} · {FRAME_WALL_LABEL[frame.wall]} · {links.length} linked
                </span>
              </span>
            </button>

            {open && (
              <div className="mt-3 space-y-3 border-t border-border/50 pt-3">
                <Input
                  value={frame.name}
                  onChange={(e) => void run(() => updateFrame(frame.id, { name: e.target.value }))}
                  className="h-8 text-xs"
                />

                <div className="flex flex-wrap gap-1.5">
                  {WALLS.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => void run(() => updateFrame(frame.id, { wall: w }))}
                      className={`min-h-[30px] rounded-full px-2.5 text-[11px] font-semibold ${
                        frame.wall === w
                          ? "bg-primary text-primary-foreground"
                          : "border border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {FRAME_WALL_LABEL[w]}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {FRAME_DESIGNS.map((d) => (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => void run(() => updateFrame(frame.id, { design: d.key }))}
                      className={`overflow-hidden rounded-lg border ${
                        frame.design === d.key ? "border-primary ring-1 ring-primary/50" : "border-border/60"
                      }`}
                    >
                      <img src={d.url} alt={d.label} className="aspect-square w-full object-cover" />
                    </button>
                  ))}
                </div>

                <SliderRow
                  label="Along the wall"
                  value={frame.offset_along}
                  min={0.04}
                  max={0.96}
                  step={0.01}
                  onChange={(v) => void run(() => updateFrame(frame.id, { offset_along: v }))}
                />
                <SliderRow
                  label="Height on the wall"
                  value={frame.offset_y}
                  min={0.8}
                  max={4}
                  step={0.05}
                  onChange={(v) => void run(() => updateFrame(frame.id, { offset_y: v }))}
                />
                <SliderRow
                  label="Size"
                  value={frame.width}
                  min={FRAME_MIN_WIDTH}
                  max={FRAME_MAX_WIDTH}
                  step={0.05}
                  onChange={(v) => void run(() => updateFrame(frame.id, { width: v }))}
                />

                {/* LINKED WORK — references only. */}
                <div className="space-y-1.5">
                  {links.map((link) => (
                    <div
                      key={link.id}
                      className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/50 px-2 py-1.5"
                    >
                      <span className="min-w-0 flex-1 truncate text-[11px]">
                        {titleOf(link.content_kind, link.content_id)}
                      </span>
                      <button
                        type="button"
                        onClick={() => void run(() => removeFrameLink(link.id))}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Unlink"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <select
                    value={pickKind}
                    onChange={(e) => {
                      setPickKind(e.target.value as AcademyProductKind);
                      setPickId("");
                    }}
                    className="rounded-md border border-border bg-background px-2 py-1.5 text-[11px]"
                  >
                    <option value="course">Courses</option>
                    <option value="assessment">Assignments</option>
                    <option value="adventure">Adventures</option>
                    <option value="game">Games</option>
                  </select>
                  <select
                    value={pickId}
                    onChange={(e) => setPickId(e.target.value)}
                    className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-[11px]"
                  >
                    <option value="">Choose an item…</option>
                    {options.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!pickId || busy}
                    onClick={() =>
                      void run(async () => {
                        await addFrameLink(frame.id, pickKind, pickId, links.length);
                        setPickId("");
                      })
                    }
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full text-destructive hover:text-destructive"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await deleteFrame(frame.id);
                      onSelectFrame(null);
                    })
                  }
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove this frame
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default FrameManager;

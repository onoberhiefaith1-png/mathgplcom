/**
 * FRAMES & WINDOWS — the teacher's control for the wall-mounted 3D objects.
 *
 * Every object here is built in two independent parts:
 *   1. the STRUCTURE — a real 3D frame or window surround chosen from the
 *      building's profiles, which never changes when the picture does;
 *   2. the CONTENT — a picture placed inside it, either uploaded or taken from
 *      the MathGPL gallery, replaceable at any time.
 *
 * Content frames can additionally hold LINKS to work that already exists;
 * nothing is copied, so removing a link or the whole frame never touches the
 * course, assignment, adventure or game itself. Windows are architectural only:
 * they hold a view, never a link.
 */
import { useMemo, useRef, useState } from "react";
import { Frame as FrameIcon, Image as ImageIcon, Loader2, Lock, Plus, Trash2, Unlock, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import PicturePickerDialog from "./PicturePickerDialog";
import {
  addFrameLink,
  createFrame,
  deleteFrame,
  removeFrameLink,
  updateFrame,
  uploadFrameImage,
  FRAME_MAX_RATIO,
  FRAME_MAX_WIDTH,
  FRAME_MIN_RATIO,
  FRAME_MIN_WIDTH,
  FRAME_SHAPES,
  FRAME_WALL_LABEL,
  type BuildingFrame,
  type FrameLink,
  type FrameWall,
} from "@/lib/building/frames";
import { profilesFor, frameProfile, type FrameKind } from "@/lib/building/frameStyles";
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
  /** Which section this instance edits: content frames or windows. */
  kind?: FrameKind;
}

const SliderRow = ({
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
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
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-primary disabled:opacity-40"
    />
  </label>
);

/** A miniature of the 3D structure, so the choice is obvious before building it. */
const ProfileChip = ({ profileKey, active }: { profileKey: string; active: boolean }) => {
  const p = frameProfile(profileKey, profileKey.includes("trim") ? "window" : "frame");
  return (
    <span
      className={`block rounded-md p-1.5 transition ${active ? "ring-2 ring-primary" : ""}`}
      style={{ background: p.face }}
    >
      <span className="block rounded-sm p-1" style={{ background: p.bevel }}>
        <span className="block h-8 rounded-sm" style={{ background: p.back }} />
      </span>
    </span>
  );
};

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
  kind = "frame",
}: FrameManagerProps) => {
  const isWindow = kind === "window";
  const profiles = useMemo(() => profilesFor(kind), [kind]);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [design, setDesign] = useState<string>(profiles[0].key);
  const [place, setPlace] = useState<string>("");
  const [wall, setWall] = useState<FrameWall>("leftWall");
  const [name, setName] = useState("");
  const [pickKind, setPickKind] = useState<AcademyProductKind>("course");
  const [pickId, setPickId] = useState("");
  const [gallery, setGallery] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const uploadTarget = useRef<string | null>(null);
  const { toast } = useToast();

  const mine = useMemo(() => frames.filter((f) => (f.kind ?? "frame") === kind), [frames, kind]);

  const places = useMemo(
    () => [
      ...walkways.map((w) => ({ value: `hall:${w.id}`, label: `Hallway · ${w.name}` })),
      ...classrooms.map((c) => ({ value: `room:${c.id}`, label: `Room · ${c.name}` })),
    ],
    [walkways, classrooms],
  );

  const linksOf = (frameId: string) =>
    frameLinks.filter((l) => l.frame_id === frameId).sort((a, b) => a.position - b.position);

  const titleOf = (k: AcademyProductKind, id: string) =>
    catalogue.find((p) => p.kind === k && p.id === id)?.title ?? "Unavailable item";

  const placeLabel = (frame: BuildingFrame) =>
    frame.walkway_id
      ? `Hallway · ${walkways.find((w) => w.id === frame.walkway_id)?.name ?? "Unknown"}`
      : `Room · ${classrooms.find((c) => c.id === frame.classroom_id)?.name ?? "Unknown"}`;

  /**
   * Every change here writes straight away. A failure must be visible: a silent
   * rejection is how a picture appeared to "not go in" at all.
   */
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      await onChanged();
    } catch (error) {
      toast({
        title: "That did not save",
        description: (error as Error)?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const submitNew = async () => {
    const target = place || places[0]?.value;
    if (!target) return;
    const [where, id] = target.split(":");
    await run(async () => {
      const created = await createFrame({
        buildingId,
        walkwayId: where === "hall" ? id : null,
        classroomId: where === "room" ? id : null,
        wall,
        kind,
        design,
        name: name.trim() || frameProfile(design, kind).label,
      });
      onSelectFrame(created.id);
      setAdding(false);
      setName("");
    });
  };

  /** A picture going in is confirmed, so nothing ever looks silently ignored. */
  const confirmPicture = () =>
    toast({
      title: isWindow ? "The view is in the window" : "The picture is in the frame",
      description: "Walk up to it in the building to see it.",
    });

  const onFile = async (file: File | undefined) => {
    const id = uploadTarget.current;
    if (!file || !id) return;
    await run(async () => {
      await uploadFrameImage(id, file);
      confirmPicture();
    });
  };

  const options = catalogue.filter((p) => p.kind === pickKind);

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.currentTarget.value = "";
        }}
      />

      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          {isWindow
            ? "Install a window in a wall, then choose the view seen through it."
            : "Build a frame on a wall, put a picture inside it, and link work that already exists."}
        </p>
        <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)} disabled={busy}>
          {adding ? <X className="mr-1.5 h-3.5 w-3.5" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
          {adding ? "Cancel" : isWindow ? "Add window" : "Add frame"}
        </Button>
      </div>

      {adding && (
        <div className="space-y-3 rounded-xl border border-border/60 bg-background/50 p-3">
          <div className="grid grid-cols-2 gap-2">
            {profiles.map((p) => (
              <button key={p.key} type="button" onClick={() => setDesign(p.key)} className="text-left">
                <ProfileChip profileKey={p.key} active={design === p.key} />
                <span className="mt-1 block truncate text-[10px]">{p.label}</span>
              </button>
            ))}
          </div>

          <label className="block text-[11px] text-muted-foreground">
            Where does it go?
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
            placeholder={isWindow ? "Window name, e.g. Courtyard view" : "Frame name, e.g. This week's assignments"}
            className="h-9 text-xs"
          />

          <Button size="sm" className="w-full" onClick={() => void submitNew()} disabled={busy || places.length === 0}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FrameIcon className="mr-2 h-4 w-4" />}
            {isWindow ? "Install the window" : "Build the frame"}
          </Button>
        </div>
      )}

      {mine.length === 0 && !adding && (
        <p className="rounded-lg border border-dashed border-border/60 px-3 py-6 text-center text-[11px] text-muted-foreground">
          {isWindow ? "No windows yet." : "No frames yet."}
        </p>
      )}

      {mine.map((frame) => {
        const open = selectedFrameId === frame.id;
        const links = linksOf(frame.id);
        const locked = frame.locked;
        return (
          <div key={frame.id} className="rounded-xl border border-border/60 bg-card/40 p-3">
            <button
              type="button"
              onClick={() => onSelectFrame(open ? null : frame.id)}
              className="flex w-full items-center gap-2 text-left"
            >
              <span className="h-9 w-9 shrink-0">
                <ProfileChip profileKey={frame.design} active={false} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">{frame.name}</span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  {placeLabel(frame)} · {FRAME_WALL_LABEL[frame.wall]}
                  {isWindow ? "" : ` · ${links.length} linked`}
                </span>
              </span>
              {locked && <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
            </button>

            {open && (
              <div className="mt-3 space-y-3 border-t border-border/50 pt-3">
                <Input
                  value={frame.name}
                  onChange={(e) => void run(() => updateFrame(frame.id, { name: e.target.value }))}
                  className="h-8 text-xs"
                />

                {/* STRUCTURE — changing it never touches the picture inside. */}
                <div className="grid grid-cols-2 gap-2">
                  {profiles.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      disabled={locked}
                      onClick={() => void run(() => updateFrame(frame.id, { design: p.key }))}
                      className="text-left disabled:opacity-40"
                    >
                      <ProfileChip profileKey={p.key} active={frame.design === p.key} />
                      <span className="mt-1 block truncate text-[10px]">{p.label}</span>
                    </button>
                  ))}
                </div>

                {/* CONTENT — the picture inside the object. */}
                <div className="space-y-2 rounded-lg border border-border/50 bg-background/50 p-2">
                  <p className="text-[11px] font-semibold">
                    {isWindow ? "View through the window" : "Picture inside the frame"}
                  </p>
                  {/* Straight from this page, from your own device — the main way
                      a picture gets in. */}
                  <Button
                    size="sm"
                    className="w-full"
                    disabled={busy}
                    onClick={() => {
                      uploadTarget.current = frame.id;
                      fileRef.current?.click();
                    }}
                  >
                    <ImageIcon className="mr-1.5 h-3.5 w-3.5" />
                    {frame.content_path ? "Choose a different picture" : "Add a picture from my device"}
                  </Button>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setGallery(frame.id)}
                      className="text-[10px] font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      or pick one from MathGPL assets
                    </button>
                    {frame.content_path && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[10px]"
                        disabled={busy}
                        onClick={() => void run(() => updateFrame(frame.id, { content_path: null }))}
                      >
                        <X className="mr-1 h-3 w-3" /> Take it out
                      </Button>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {frame.content_path ? "A picture is inside it." : "Nothing inside it yet."} Changes
                    here save as you make them.
                  </p>
                </div>

                {/* SIZE AND POSITION — same controls as the Smart Screen, right
                    under the picture so both live together. */}
                <div className="space-y-2 rounded-lg border border-border/50 bg-background/50 p-2">
                  <p className="text-[11px] font-semibold">Size and position</p>

                  {/* SHAPE — one tap for the usual three, then free fine-tuning. */}
                  <div className="flex flex-wrap gap-1.5">
                    {FRAME_SHAPES.map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        disabled={locked}
                        onClick={() => void run(() => updateFrame(frame.id, { height_ratio: s.ratio }))}
                        className={`min-h-[30px] rounded-full px-2.5 text-[11px] font-semibold disabled:opacity-40 ${
                          Math.abs(frame.height_ratio - s.ratio) < 0.03
                            ? "bg-primary text-primary-foreground"
                            : "border border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>

                  <SliderRow
                    label="Bigger / smaller"
                    value={frame.width}
                    min={FRAME_MIN_WIDTH}
                    max={FRAME_MAX_WIDTH}
                    step={0.05}
                    disabled={locked}
                    onChange={(v) => void run(() => updateFrame(frame.id, { width: v }))}
                  />
                  <SliderRow
                    label="Shape (height ÷ width)"
                    value={frame.height_ratio}
                    min={FRAME_MIN_RATIO}
                    max={FRAME_MAX_RATIO}
                    step={0.01}
                    disabled={locked}
                    onChange={(v) => void run(() => updateFrame(frame.id, { height_ratio: v }))}
                  />
                  <SliderRow
                    label="Across the wall"
                    value={frame.offset_along}
                    min={0.04}
                    max={0.96}
                    step={0.01}
                    disabled={locked}
                    onChange={(v) => void run(() => updateFrame(frame.id, { offset_along: v }))}
                  />
                  <SliderRow
                    label="Height on the wall"
                    value={frame.offset_y}
                    min={0.8}
                    max={4}
                    step={0.05}
                    disabled={locked}
                    onChange={(v) => void run(() => updateFrame(frame.id, { offset_y: v }))}
                  />

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {WALLS.map((w) => (
                      <button
                        key={w}
                        type="button"
                        disabled={locked}
                        onClick={() => void run(() => updateFrame(frame.id, { wall: w }))}
                        className={`min-h-[30px] rounded-full px-2.5 text-[11px] font-semibold disabled:opacity-40 ${
                          frame.wall === w
                            ? "bg-primary text-primary-foreground"
                            : "border border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {FRAME_WALL_LABEL[w]}
                      </button>
                    ))}
                  </div>
                </div>



                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  disabled={busy}
                  onClick={() => void run(() => updateFrame(frame.id, { locked: !locked }))}
                >
                  {locked ? (
                    <>
                      <Unlock className="mr-1.5 h-3.5 w-3.5" /> Unlock position
                    </>
                  ) : (
                    <>
                      <Lock className="mr-1.5 h-3.5 w-3.5" /> Lock in place
                    </>
                  )}
                </Button>

                {/* LINKED WORK — references only, and never on a window. */}
                {!isWindow && (
                  <>
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
                  </>
                )}

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
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> {isWindow ? "Remove this window" : "Remove this frame"}
                </Button>
              </div>
            )}
          </div>
        );
      })}

      <PicturePickerDialog
        open={gallery !== null}
        title={isWindow ? "Choose the view" : "Choose a picture"}
        onOpenChange={(o) => {
          if (!o) setGallery(null);
        }}
        onChoose={(path) => {
          const id = gallery;
          if (!id) return;
          void run(async () => {
            await updateFrame(id, { content_path: path });
            confirmPicture();
          });
        }}
      />
    </div>
  );
};

export default FrameManager;

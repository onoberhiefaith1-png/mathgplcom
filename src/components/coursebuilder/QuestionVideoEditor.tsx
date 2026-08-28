// Add Video — the teacher's timeline editor for ONE Exercise Card question.
//
// ONE continuous upload. Nothing is ever split: each section simply stores the
// range of the SAME file that belongs to it, keyed by that section's own line
// identity. The player is fixed at the top of the dialog and the section list
// scrolls independently underneath it, so Play / Pause / the playhead and both
// "use playhead" buttons stay reachable from Line 1 all the way to Line M.
//
// Timeline law:
//   · an unset boundary is null and reads "Not set" — never 0:00
//   · confirming an end prepares the NEXT start at end + 1s, immediately
//   · a prepared start is only a suggestion and may be edited freely
//   · editing a start NEVER moves the previous section's end
//   · gaps and overlaps are allowed and are never auto-corrected

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Maximize2, Minimize2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { courseMediaUrl, uploadCourseMedia } from "@/lib/courses/media";
import {
  emptySectionsFor,
  emptyVideoConfig,
  fmtClock,
  overlapsFor,
  parseClock,
  sectionsFor,
  writeBoundary,
  type QuestionVideoConfig,
  type VideoLine,
  type VideoSection,
} from "@/lib/courses/questionVideo";
import { removeQuestionVideo, saveQuestionVideo } from "@/lib/courses/questionVideoStore";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  blockId: string;
  questionId: string;
  questionLabel: string;
  lines: VideoLine[];
  config: QuestionVideoConfig | null;
  onSaved: (cfg: QuestionVideoConfig | null) => void;
}

const QuestionVideoEditor = ({
  open,
  onOpenChange,
  courseId,
  blockId,
  questionId,
  questionLabel,
  lines,
  config,
  onSaved,
}: Props) => {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const [isFs, setIsFs] = useState(false);
  const [draft, setDraft] = useState<QuestionVideoConfig>(config ?? emptyVideoConfig());
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [playhead, setPlayhead] = useState(0);

  useEffect(() => { if (open) setDraft(config ?? emptyVideoConfig()); }, [open, config]);

  useEffect(() => {
    const el = playerRef.current;
    if (!el) return;
    const onChange = () => setIsFs(document.fullscreenElement === el);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const togglePlayerFs = async () => {
    const el = playerRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement === el) await document.exitFullscreen();
      else await el.requestFullscreen();
    } catch { /* unsupported / user gesture */ }
  };

  useEffect(() => {
    let cancelled = false;
    void courseMediaUrl(draft.videoPath).then((next) => { if (!cancelled) setUrl(next); });
    return () => { cancelled = true; };
  }, [draft.videoPath]);

  const sections = useMemo(() => sectionsFor(lines, draft), [lines, draft]);
  const overlapping = useMemo(() => overlapsFor(sections), [sections]);
  const invalid = useMemo(() => emptySectionsFor(sections), [sections]);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const path = await uploadCourseMedia(courseId, file);
      setDraft((d) => ({ ...d, videoPath: path, checkpoints: {}, segments: [] }));
      toast({ title: "Video uploaded", description: "Now set each section's start and end." });
    } catch (e) {
      toast({ title: "Upload failed", description: String((e as Error)?.message ?? e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  /**
   * Markers only, written against the section's own key. Confirming an end also
   * prepares the next start; every other section is left untouched.
   */
  const setBoundary = (key: string, field: "start" | "end", seconds: number | null) =>
    setDraft((d) => {
      const base = d ?? emptyVideoConfig();
      const segments = writeBoundary(sectionsFor(lines, base), key, field, seconds);
      // The legacy end-only map is no longer authoritative once explicit
      // markers exist — clearing it stops old chained values reappearing.
      return { ...base, segments, checkpoints: {} };
    });

  const save = async () => {
    if (invalid.length > 0) {
      const names = sections.filter((s) => invalid.includes(s.key)).map((s) => s.label).join(", ");
      toast({
        title: "Some sections end before they start",
        description: `${names} would play for zero seconds. Move each end later than its own start.`,
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      await saveQuestionVideo(blockId, questionId, draft);
      onSaved(draft);
      onOpenChange(false);
      toast({ title: "Teaching video saved" });
    } catch (e) {
      toast({ title: "Could not save", description: String((e as Error)?.message ?? e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const removeAll = async () => {
    setBusy(true);
    try {
      await removeQuestionVideo(blockId, questionId);
      onSaved(null);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  const boundaryField = (s: VideoSection, field: "start" | "end") => {
    const value = field === "start" ? s.startAt : s.endAt;
    const prepared = field === "start" && s.startSource === "auto" && s.startAt !== null;
    return (
      <div className="flex items-center gap-1.5">
        <span className="w-9 text-xs text-muted-foreground">{field === "start" ? "start" : "end"}</span>
        <Input
          className="h-8 w-24 font-mono text-xs"
          key={`${s.key}:${field}:${value ?? "unset"}`}
          defaultValue={value === null ? "" : fmtClock(value)}
          placeholder="Not set"
          aria-label={`${s.label} ${field} time`}
          onBlur={(e) => {
            const raw = e.target.value.trim();
            if (raw === "") { setBoundary(s.key, field, null); return; }
            const parsed = parseClock(raw);
            if (parsed !== null) setBoundary(s.key, field, parsed);
          }}
        />
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          disabled={!draft.videoPath}
          onClick={() => {
            const at = Math.max(0, videoRef.current?.currentTime ?? playhead);
            setBoundary(s.key, field, at);
          }}
        >
          Use {fmtClock(playhead)}
        </Button>
        {prepared && (
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">prepared</span>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Fixed height + no scroll here: the player never leaves the viewport. */}
      <DialogContent className="flex h-[88vh] max-w-3xl flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>Teaching video — {questionLabel}</DialogTitle>
        </DialogHeader>

        {/* ── Fixed player region ──────────────────────────────────────── */}
        <div className="shrink-0 space-y-3 border-b border-border pb-3">
          <div ref={playerRef} className="relative overflow-hidden rounded-lg bg-black">
            <button
              type="button"
              onClick={togglePlayerFs}
              disabled={!url}
              aria-label={isFs ? "Exit full screen" : "Full screen"}
              title={isFs ? "Exit full screen" : "Full screen"}
              className="absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md bg-black/50 text-white/90 opacity-0 transition-opacity hover:bg-black/70 focus:opacity-100 disabled:pointer-events-none disabled:opacity-0 group-hover:opacity-100"
            >
              {isFs ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            {url ? (
              <video
                ref={videoRef}
                src={url}
                controls
                playsInline
                className="max-h-[260px] w-full"
                onLoadedMetadata={(e) => {
                  const next = Number(e.currentTarget?.duration);
                  setDraft((d) => {
                    const base = d ?? emptyVideoConfig();
                    return { ...base, duration: Number.isFinite(next) && next > 0 ? next : base.duration };
                  });
                }}
                onTimeUpdate={(e) => setPlayhead(e.currentTarget.currentTime)}
              />
            ) : (
              <div className="grid h-40 place-items-center text-xs text-white/60">
                No video uploaded yet
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex">
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file);
                  e.target.value = "";
                }}
              />
              <Button asChild size="sm" variant="outline" disabled={busy}>
                <span className="cursor-pointer">
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {draft.videoPath ? "Replace video" : "Upload video"}
                </span>
              </Button>
            </label>
            <span className="text-xs text-muted-foreground">
              Playhead <span className="font-mono">{fmtClock(playhead)}</span> · length{" "}
              <span className="font-mono">{fmtClock(draft.duration)}</span>
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-2">
              <span className="text-sm">Introduction <span className="text-xs text-muted-foreground">(optional)</span></span>
              <Switch
                checked={draft.introEnabled}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, introEnabled: v }))}
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-2">
              <span className="text-sm">Conclusion <span className="text-xs text-muted-foreground">(optional)</span></span>
              <Switch
                checked={draft.conclusionEnabled}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, conclusionEnabled: v }))}
              />
            </label>
          </div>
        </div>

        {/* ── Independently scrolling section list ─────────────────────── */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {sections.map((s) => (
              <li key={s.key} className="space-y-2 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-[110px] text-sm font-medium">{s.label}</span>
                  <span
                    className={
                      s.required
                        ? "rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
                        : "rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                    }
                  >
                    {s.required ? "required" : "optional"}
                  </span>
                  {s.configured ? (
                    <span className="text-[11px] font-medium text-primary">✓ Line configured</span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">
                      {s.startAt === null && s.endAt === null ? "Not set" : "End not set"}
                    </span>
                  )}
                  {invalid.includes(s.key) && (
                    <span className="text-[10px] font-medium text-destructive">ends before it starts</span>
                  )}
                  {overlapping.includes(s.key) && (
                    <span className="text-[10px] text-muted-foreground">overlaps a neighbour (allowed)</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  {boundaryField(s, "start")}
                  {boundaryField(s, "end")}
                </div>
              </li>
            ))}
            {sections.length === 0 && (
              <li className="p-4 text-sm text-muted-foreground">
                This question has no mathematical lines yet.
              </li>
            )}
          </ul>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border pt-3">
          {config?.videoPath ? (
            <Button variant="ghost" className="text-destructive" onClick={() => void removeAll()} disabled={busy}>
              <Trash2 className="mr-2 h-4 w-4" /> Remove video
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => void save()} disabled={busy || !draft.videoPath}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save video
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuestionVideoEditor;

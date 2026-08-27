// Add Video — the teacher's checkpoint editor for ONE Exercise Card question.
//
// One continuous upload. The teacher only marks where each section ENDS; the
// previous checkpoint automatically starts the next one. The section list comes
// from the question's own mathematical lines, so authoring can never disagree
// with the board: Introduction and Conclusion are optional, every line is
// mandatory.

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";
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
  markersFor,
  overlapsFor,
  parseClock,
  sectionsFor,
  type QuestionVideoConfig,
  type VideoLine,
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
  const [draft, setDraft] = useState<QuestionVideoConfig>(config ?? emptyVideoConfig());
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [playhead, setPlayhead] = useState(0);

  useEffect(() => { if (open) setDraft(config ?? emptyVideoConfig()); }, [open, config]);

  useEffect(() => {
    let cancelled = false;
    void courseMediaUrl(draft.videoPath).then((next) => { if (!cancelled) setUrl(next); });
    return () => { cancelled = true; };
  }, [draft.videoPath]);

  const sections = useMemo(() => sectionsFor(lines, draft), [lines, draft]);
  const overlapping = useMemo(() => overlapsFor(sections), [sections]);
  const empties = useMemo(() => emptySectionsFor(sections), [sections]);

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
   * Markers only — the uploaded file is never split, and only a section's END
   * is written. Each start is the boundary above it, so a section of no
   * duration cannot be created.
   */
  const setMarker = (key: string, seconds: number) =>
    setDraft((d) => {
      const base = d ?? emptyVideoConfig();
      const current = markersFor(sectionsFor(lines, base));
      const value = Math.max(0, seconds);
      const next = current.map((m) => (m.key === key ? { key: m.key, start: m.start, end: value } : m));
      const checkpoints: Record<string, number> = {};
      next.forEach((m) => { checkpoints[m.key] = m.end; });
      return { ...base, segments: next, checkpoints };
    });

  const save = async () => {
    if (empties.length > 0) {
      const names = sections.filter((s) => empties.includes(s.key)).map((s) => s.label).join(", ");
      toast({
        title: "Some sections have no duration",
        description: `${names} would play for zero seconds. Move each end later than the section above it.`,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Teaching video — {questionLabel}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="overflow-hidden rounded-lg bg-black">
            {url ? (
              <video
                ref={videoRef}
                src={url}
                controls
                playsInline
                className="max-h-[300px] w-full"
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
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <span className="text-sm">Introduction <span className="text-xs text-muted-foreground">(optional)</span></span>
              <Switch
                checked={draft.introEnabled}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, introEnabled: v }))}
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <span className="text-sm">Conclusion <span className="text-xs text-muted-foreground">(optional)</span></span>
              <Switch
                checked={draft.conclusionEnabled}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, conclusionEnabled: v }))}
              />
            </label>
          </div>

          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {sections.map((s) => (
             <li key={s.key} className="flex flex-wrap items-center gap-2 p-3">
                <span className="min-w-[120px] text-sm font-medium">{s.label}</span>
                {overlapping.includes(s.key) && (
                  <span className="text-[10px] font-medium text-destructive">check order</span>
                )}
                {empties.includes(s.key) && (
                  <span className="text-[10px] font-medium text-destructive">no duration</span>
                )}
                <span
                  className={
                    s.required
                      ? "rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
                      : "rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                  }
                >
                  {s.required ? "required" : "optional"}
                </span>
                <div className="ml-auto flex flex-wrap items-center gap-3">
                  {/* The start is the boundary above — shown, never edited. */}
                  <span className="text-xs text-muted-foreground">
                    starts <span className="font-mono">{fmtClock(s.start)}</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">ends</span>
                    <Input
                      className="h-8 w-20 font-mono text-xs"
                      defaultValue={fmtClock(s.end)}
                      key={`${s.key}:end:${s.end}`}
                      onBlur={(e) => {
                        const parsed = parseClock(e.target.value);
                        if (parsed !== null) setMarker(s.key, parsed);
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => {
                        const at = videoRef.current?.currentTime ?? playhead;
                        setMarker(s.key, at);
                        toast({ title: `${s.label} ends at ${fmtClock(at)}` });
                      }}
                      disabled={!draft.videoPath}
                    >
                      End at playhead
                    </Button>
                  </div>
                </div>
              </li>
            ))}
            {sections.length === 0 && (
              <li className="p-4 text-sm text-muted-foreground">
                This question has no mathematical lines yet.
              </li>
            )}
          </ul>

          <div className="flex items-center justify-between gap-2">
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
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuestionVideoEditor;

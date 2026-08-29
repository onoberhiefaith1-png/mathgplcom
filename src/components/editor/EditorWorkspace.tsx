import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditorTopBar } from "./EditorTopBar";
import { PreviewPlayer } from "./PreviewPlayer";
import { WorkflowBar } from "./WorkflowBar";
import { VersionBar } from "./VersionBar";
import { WorkflowStages } from "./WorkflowStages";
import { Timeline } from "./Timeline";
import { UploadDropzone } from "./UploadDropzone";
import { createProject, useProjectHistory } from "@/lib/editor/project";
import { extractWaveform, generateThumbnails, type Thumbnail } from "@/lib/editor/media";
import { loadProject, newProjectId, saveProject } from "@/lib/editor/storage";
import { usePlayback } from "@/lib/editor/usePlayback";
import { useWorkflow } from "@/lib/editor/useWorkflow";
import { FRAME, type ProjectState, createEmptyProject } from "@/lib/editor/types";
import { visibleStages } from "@/lib/editor/workflow";

interface Source {
  file: File;
  url: string;
  duration: number;
}

export function EditorWorkspace({ projectId }: { projectId?: string | undefined }) {
  const navigate = useNavigate();
  const idRef = useRef(projectId ?? newProjectId());
  const createdAt = useRef(Date.now());
  const [course, setCourse] = useState("My course");
  const [source, setSource] = useState<Source | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [thumbnails, setThumbnails] = useState<Thumbnail[]>([]);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [waveformReady, setWaveformReady] = useState(false);
  const [pxPerSecond, setPxPerSecond] = useState(24);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const { project, segments, duration, dispatch, undo, redo, canUndo, canRedo } =
    useProjectHistory(createEmptyProject());

  const { videoRef, tlTime, playing, seek, toggle } = usePlayback(segments, duration);

  const markDirty = useCallback(() => setDirty(true), []);

  const wf = useWorkflow({
    file: source?.file ?? null,
    clips: project.clips,
    onDirty: markDirty,
  });
  const wfRef = useRef(wf);
  wfRef.current = wf;

  const analyse = useCallback(async (file: File, sourceDuration: number) => {
    setWaveformReady(false);
    setThumbnails([]);
    setPeaks([]);
    const [thumbs, wave] = await Promise.all([
      generateThumbnails(file, sourceDuration),
      extractWaveform(file),
    ]);
    setThumbnails(thumbs);
    setPeaks(wave);
    setWaveformReady(true);
  }, []);

  const openFile = useCallback(
    async (file: File, restored?: { project: ProjectState; duration: number }) => {
      setPreparing(true);
      try {
        const url = URL.createObjectURL(file);
        const duration =
          restored?.duration ??
          (await new Promise<number>((resolve, reject) => {
            const probe = document.createElement("video");
            probe.preload = "metadata";
            probe.src = url;
            probe.onloadedmetadata = () => resolve(probe.duration);
            probe.onerror = () => reject(new Error("Could not read this video file"));
          }));
        setSource({ file, url, duration });
        dispatch({
          type: "load",
          state: restored?.project ?? createProject(file.name.replace(/\.[^.]+$/, ""), duration),
        });
        setPxPerSecond(Math.min(80, Math.max(6, 900 / Math.max(duration, 1))));
        setDirty(false);
        void analyse(file, duration);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not open this video");
      } finally {
        setPreparing(false);
      }
    },
    [analyse, dispatch],
  );

  // Restore the last saved project (original file included) on mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const stored = projectId ? await loadProject(projectId) : null;
        if (!cancelled && stored) {
          const file = new File([stored.file], stored.fileName, { type: stored.fileType });
          await openFile(file, { project: stored.project, duration: stored.sourceDuration });
          createdAt.current = stored.createdAt;
          setCourse(stored.course);
          if (stored.workflow) {
            wfRef.current.restore(
              stored.workflow,
              stored.audioBlob ?? null,
              stored.voiceClips ?? {},
              stored.trackBlob ?? null,
              stored.versionTracks ?? {},
              stored.branchClips ?? {},
              stored.branchTracks ?? {},
              stored.generatedVideoBlob ?? null,
            );
          }
          setSavedAt(stored.savedAt);
          toast.success("Project opened");
        }
      } catch {
        /* nothing saved yet */
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const edit = useCallback<typeof dispatch>(
    (action, options) => {
      dispatch(action, options);
      markDirty();
    },
    [dispatch, markDirty],
  );

  const handleSave = useCallback(async () => {
    if (!source) return;
    try {
      const languages = ["Original", ...wf.state.branches.map((b) => b.language)];
      await saveProject({
        key: idRef.current,
        title: project.title,
        course,
        createdAt: createdAt.current,
        savedAt: Date.now(),
        duration: duration,
        status: wf.state.published ? "complete" : wf.state.generatedTrack ? "processing" : "draft",
        languages,
        thumbnail: thumbnails[0]?.url,
        fileName: source.file.name,
        project,
        file: source.file,
        fileType: source.file.type,
        sourceDuration: source.duration,
        workflow: wf.state,
        audioBlob: wf.audio?.blob ?? null,
        voiceClips: wf.voiceClips,
        trackBlob: wf.generatedTrack?.blob ?? null,
        generatedVideoBlob: wf.generatedVideo?.blob ?? null,
        ...(wf.generatedVideo
          ? { generatedVideoName: `final.${wf.generatedVideo.meta.extension}` }
          : {}),
        versionTracks: wf.versionTracks,
        branchClips: { ...wf.branchClips, [wf.activeBranch]: wf.voiceClips },
        branchTracks: {
          ...wf.branchTracks,
          ...(wf.generatedTrack ? { [wf.activeBranch]: wf.generatedTrack.blob } : {}),
        },
      });
      setDirty(false);
      setSavedAt(Date.now());
      toast.success("Project saved — your original video is untouched");
    } catch {
      toast.error("Could not save the project in this browser");
    }
  }, [course, duration, project, source, thumbnails, wf]);

  const saveRef = useRef(handleSave);
  saveRef.current = handleSave;

  // Autosave: the project must always exist in the gallery, even if the user
  // never presses Save.
  useEffect(() => {
    if (!source || restoring) return;
    void saveRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, restoring]);

  useEffect(() => {
    if (!source || restoring) return;
    const timer = window.setInterval(() => {
      void saveRef.current();
    }, 15000);
    const onHide = () => {
      if (document.visibilityState === "hidden") void saveRef.current();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [source, restoring]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!source) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        setDirty(true);
        return;
      }
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void handleSave();
        return;
      }
      switch (e.key) {
        case " ":
          e.preventDefault();
          toggle();
          break;
        case "s":
        case "S":
          edit({ type: "split", time: tlTime });
          break;
        case "Delete":
        case "Backspace":
          if (selectedId) {
            edit({ type: "delete", id: selectedId });
            setSelectedId(null);
          }
          break;
        case "ArrowLeft":
          seek(tlTime - (e.shiftKey ? 1 : FRAME));
          break;
        case "ArrowRight":
          seek(tlTime + (e.shiftKey ? 1 : FRAME));
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [source, edit, handleSave, redo, seek, selectedId, tlTime, toggle, undo]);

  const status = useMemo(() => {
    if (!source) return "No video loaded";
    if (savedAt) return `Saved ${new Date(savedAt).toLocaleTimeString()}`;
    return "Draft";
  }, [savedAt, source]);

  if (!source) {
    return (
      <div className="dark min-h-screen bg-background text-foreground">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Button variant="ghost" size="sm" onClick={() => void navigate({ to: "/" })}>
            <ArrowLeft className="mr-1.5 size-4" />
            Back
          </Button>
          <div>
            <h1 className="text-sm font-semibold">Course Video Editor</h1>
            <p className="text-xs text-muted-foreground">MathGPL · lesson production workspace</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => void navigate({ to: "/gallery" })}
          >
            Gallery
          </Button>
        </div>
        <UploadDropzone onFile={(file) => void openFile(file)} busy={preparing || restoring} />
      </div>
    );
  }

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <EditorTopBar
        title={project.title}
        onTitleChange={(title) => edit({ type: "setTitle", title }, { coalesceKey: "title" })}
        status={status}
        dirty={dirty}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => {
          undo();
          setDirty(true);
        }}
        onRedo={() => {
          redo();
          setDirty(true);
        }}
        onSave={() => void handleSave()}
        onPreview={() => {
          previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          seek(0);
        }}
        onBack={() => void navigate({ to: "/" })}
      />

      <WorkflowBar
        current={wf.state.current}
        statusOf={wf.statusOf}
        stages={visibleStages(wf.state)}
        onNavigate={(id) => {
          wf.goTo(id);
          document
            .getElementById(`stage-${id}`)
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />

      <VersionBar wf={wf} />

      <main className="mx-auto flex max-w-[1400px] flex-col gap-4 p-4">
        <div ref={previewRef} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <PreviewPlayer
            src={source.url}
            videoRef={videoRef}
            tlTime={tlTime}
            duration={duration}
            playing={playing}
            onToggle={toggle}
            onSeek={seek}
          />
          <aside className="rounded-lg border border-border bg-card p-4 text-sm">
            <h3 className="font-semibold">Source</h3>
            <dl className="mt-3 space-y-2 text-xs text-muted-foreground">
              <Row label="File" value={source.file.name} />
              <Row label="Original length" value={`${source.duration.toFixed(2)}s`} />
              <Row label="Edited length" value={`${duration.toFixed(2)}s`} />
              <Row label="Clips" value={String(segments.length)} />
              <Row label="Audio waveform" value={waveformReady ? "Ready" : "Reading…"} />
            </dl>
            <p className="mt-4 rounded-md bg-secondary/60 p-2 text-[11px] leading-relaxed text-muted-foreground">
              Cuts are stored as an edit list. The uploaded file is preserved exactly as it was
              delivered, so you can always return to the original.
            </p>
            <div className="mt-4 space-y-1 text-[11px] text-muted-foreground">
              <p className="font-medium text-foreground">Shortcuts</p>
              <p>Space play/pause · S split · Del delete clip</p>
              <p>← → step a frame · Shift + ← → one second</p>
              <p>Ctrl/Cmd + Z undo · Shift + Z redo · Ctrl/Cmd + S save</p>
            </div>
          </aside>
        </div>

        <Timeline
          segments={segments}
          duration={duration}
          sourceDuration={source.duration}
          tlTime={tlTime}
          pxPerSecond={pxPerSecond}
          onZoom={(next) => setPxPerSecond(Math.min(400, Math.max(2, next)))}
          onSeek={seek}
          selectedId={selectedId}
          onSelect={setSelectedId}
          dispatch={edit}
          thumbnails={thumbnails}
          peaks={peaks}
          waveformReady={waveformReady}
          onUndo={() => {
            undo();
            setDirty(true);
          }}
          onRedo={() => {
            redo();
            setDirty(true);
          }}
          canUndo={canUndo}
          canRedo={canRedo}
        />

        <WorkflowStages
          wf={wf}
          tlTime={tlTime}
          onSeek={seek}
          clipCount={segments.length}
          onSave={() => void handleSave()}
          videoSrc={source.url}
          segments={segments}
          duration={duration}
        />
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt>{label}</dt>
      <dd className="truncate font-mono text-foreground">{value}</dd>
    </div>
  );
}

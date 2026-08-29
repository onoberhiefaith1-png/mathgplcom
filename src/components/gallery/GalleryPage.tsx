import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Copy, Download, Pencil, Play, Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SiteNav } from "@/components/courseedit/CourseEditNav";
import {
  deleteProject,
  duplicateProject,
  listProjects,
  loadProject,
  updateProjectMeta,
  type ProjectMeta,
} from "@/lib/editor/storage";
import { formatTimecode } from "@/lib/editor/types";

type Filter = "all" | "complete" | "draft" | "recent";

const STATUS_LABEL = { draft: "Draft", processing: "Processing", complete: "Complete" } as const;

export function GalleryPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [language, setLanguage] = useState("all");
  const [preview, setPreview] = useState<{
    meta: ProjectMeta;
    videoUrl: string;
    audioUrl?: string;
  } | null>(null);
  const [share, setShare] = useState<ProjectMeta | null>(null);
  const [renaming, setRenaming] = useState<{ meta: ProjectMeta; title: string } | null>(null);

  const refresh = useCallback(() => {
    void listProjects()
      .then(setProjects)
      .catch(() => setProjects([]));
  }, []);

  useEffect(refresh, [refresh]);

  const languages = useMemo(
    () => Array.from(new Set(projects.flatMap((p) => p.languages ?? []))),
    [projects],
  );

  const visible = useMemo(() => {
    let list = [...projects];
    if (filter === "complete") list = list.filter((p) => p.status === "complete");
    if (filter === "draft") list = list.filter((p) => p.status !== "complete");
    if (filter === "recent") list = list.slice(0, 6);
    if (language !== "all") list = list.filter((p) => (p.languages ?? []).includes(language));
    return list;
  }, [filter, language, projects]);

  const openPreview = useCallback(async (meta: ProjectMeta) => {
    const stored = await loadProject(meta.key);
    if (!stored) return;
    setPreview({
      meta,
      // Prefer the rendered final video: picture + generated audio in one file.
      videoUrl: URL.createObjectURL(stored.generatedVideoBlob ?? stored.file),
      ...(stored.generatedVideoBlob
        ? {}
        : stored.trackBlob
          ? { audioUrl: URL.createObjectURL(stored.trackBlob) }
          : {}),
    });
  }, []);

  const download = useCallback(async (meta: ProjectMeta) => {
    const stored = await loadProject(meta.key);
    if (!stored) return;
    const save = (blob: Blob, name: string) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    };
    const slug =
      meta.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "lesson";
    if (stored.generatedVideoBlob) {
      const ext = (stored.generatedVideoName?.split(".").pop() ?? "mp4").toLowerCase();
      save(stored.generatedVideoBlob, `${slug}-final.${ext}`);
      toast.success("Downloaded the final generated video");
      return;
    }
    save(stored.file, `${slug}-video.${stored.fileName.split(".").pop() ?? "mp4"}`);
    if (stored.trackBlob) save(stored.trackBlob, `${slug}-generated-audio.wav`);
    toast.success("No rendered video yet — downloaded the source video and generated audio");
  }, []);

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <SiteNav />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Gallery</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every lesson you have produced in this browser, with all of its language versions.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {(["all", "complete", "draft", "recent"] as Filter[]).map((key) => (
            <Button
              key={key}
              size="sm"
              variant={filter === key ? "default" : "outline"}
              onClick={() => setFilter(key)}
            >
              {key === "all"
                ? "All"
                : key === "complete"
                  ? "Completed"
                  : key === "draft"
                    ? "Drafts"
                    : "Recently edited"}
            </Button>
          ))}
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="h-9 w-44">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All languages</SelectItem>
              {languages.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {visible.length === 0 ? (
          <div className="mt-10 rounded-lg border border-dashed border-border p-12 text-center">
            <p className="text-sm text-muted-foreground">Nothing saved yet.</p>
            <Button className="mt-4" asChild>
              <Link to="/course-edit/engine">Start a new video</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((meta) => (
              <article
                key={meta.key}
                className="overflow-hidden rounded-lg border border-border bg-card"
              >
                <div className="aspect-video bg-secondary">
                  {meta.thumbnail ? (
                    <img
                      src={meta.thumbnail}
                      alt={`${meta.title} thumbnail`}
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  ) : null}
                </div>
                <div className="space-y-1 p-3">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-sm font-medium">{meta.title}</h2>
                    <span className="ml-auto shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                      {STATUS_LABEL[meta.status]}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{meta.course}</p>
                  <p className="text-xs text-muted-foreground">
                    {(meta.languages ?? []).join(" · ")} · {formatTimecode(meta.duration, false)} ·{" "}
                    {new Date(meta.savedAt).toLocaleDateString()}
                  </p>
                  <div className="flex flex-wrap gap-1 pt-2">
                    <Action label="Preview" onClick={() => void openPreview(meta)}>
                      <Play className="size-3.5" />
                    </Action>
                    <Action
                      label="Edit"
                      onClick={() =>
                        void navigate({ to: "/course-edit/engine", search: { project: meta.key } })
                      }
                    >
                      <Pencil className="size-3.5" />
                    </Action>
                    <Action label="Download" onClick={() => void download(meta)}>
                      <Download className="size-3.5" />
                    </Action>
                    <Action label="Share" onClick={() => setShare(meta)}>
                      <Share2 className="size-3.5" />
                    </Action>
                    <Action label="Rename" onClick={() => setRenaming({ meta, title: meta.title })}>
                      <Pencil className="size-3.5 opacity-60" />
                    </Action>
                    <Action
                      label="Duplicate"
                      onClick={() =>
                        void duplicateProject(meta.key).then(() => {
                          toast.success("Project duplicated");
                          refresh();
                        })
                      }
                    >
                      <Copy className="size-3.5" />
                    </Action>
                    <Action
                      label="Delete"
                      onClick={() =>
                        void deleteProject(meta.key).then(() => {
                          toast.success("Project deleted");
                          refresh();
                        })
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Action>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      <Dialog open={Boolean(preview)} onOpenChange={() => setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{preview?.meta.title}</DialogTitle>
            <DialogDescription>
              {preview?.audioUrl
                ? "Playing the original visuals with the generated voice track."
                : "No generated track yet — playing the original video."}
            </DialogDescription>
          </DialogHeader>
          {preview ? (
            <FinishedPlayer videoUrl={preview.videoUrl} audioUrl={preview.audioUrl} />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(share)} onOpenChange={() => setShare(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Share “{share?.title}”</DialogTitle>
            <DialogDescription>
              Links are private by default — nothing is exposed publicly unless you choose it.
            </DialogDescription>
          </DialogHeader>
          {share ? (
            <div className="space-y-3">
              <Select
                defaultValue={share.visibility ?? "private"}
                onValueChange={(value) =>
                  void updateProjectMeta(share.key, {
                    visibility: value as "private" | "link" | "members",
                  }).then(refresh)
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="link">Anyone with the link</SelectItem>
                  <SelectItem value="members">Course members</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Input readOnly value={shareLink(share.key)} className="h-9" />
                <Button
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(shareLink(share.key));
                    toast.success("Link copied");
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(renaming)} onOpenChange={() => setRenaming(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
            <DialogDescription>This only changes the project title.</DialogDescription>
          </DialogHeader>
          <Input
            value={renaming?.title ?? ""}
            onChange={(e) =>
              setRenaming((prev) => (prev ? { ...prev, title: e.target.value } : prev))
            }
            className="h-9"
          />
          <Button
            onClick={() => {
              if (!renaming) return;
              void updateProjectMeta(renaming.meta.key, { title: renaming.title }).then(() => {
                setRenaming(null);
                refresh();
              });
            }}
          >
            Save
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function shareLink(key: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/engine?project=${key}`;
}

function Action({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-[11px]" onClick={onClick}>
      {children}
      {label}
    </Button>
  );
}

/** Original visuals plus the generated voice track, kept in step while playing. */
function FinishedPlayer({
  videoUrl,
  audioUrl,
}: {
  videoUrl: string;
  audioUrl?: string | undefined;
}) {
  return (
    <div className="space-y-3">
      <video
        src={videoUrl}
        controls
        muted={Boolean(audioUrl)}
        className="w-full rounded-md bg-black"
        onPlay={(e) => {
          const audio = document.getElementById("gallery-audio") as HTMLAudioElement | null;
          if (audio) {
            audio.currentTime = e.currentTarget.currentTime;
            void audio.play();
          }
        }}
        onPause={() => {
          const audio = document.getElementById("gallery-audio") as HTMLAudioElement | null;
          audio?.pause();
        }}
        onSeeked={(e) => {
          const audio = document.getElementById("gallery-audio") as HTMLAudioElement | null;
          if (audio) audio.currentTime = e.currentTarget.currentTime;
        }}
      />
      {audioUrl ? <audio id="gallery-audio" src={audioUrl} /> : null}
    </div>
  );
}

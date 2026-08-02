import { useRef, useState } from "react";
import { Image as ImageIcon, Loader2, Sparkles, Upload, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { uploadCourseMedia } from "@/lib/courses/media";
import { useCourseMediaUrl } from "@/lib/courses/useCourseMediaUrl";
import type { Course } from "@/lib/courses/types";

const FIELD = "min-h-[44px] bg-white text-slate-900 placeholder:text-slate-400 border-slate-300";

interface Props {
  course: Course;
  onPatch: (patch: Partial<Course>) => void;
}

/** The Background belongs to the whole course — it is the course cover the
 *  title and introduction sit on top of. */
const BackgroundEditor = ({ course, onPatch }: Props) => {
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const preview = useCourseMediaUrl(course.background_url);

  const upload = async (file: File | undefined, kind: "image" | "video") => {
    if (!file) return;
    setBusy(true);
    try {
      const path = await uploadCourseMedia(course.id, file);
      onPatch({ background_kind: kind, background_url: path });
      toast({ title: `${kind === "image" ? "Image" : "Video"} background set` });
    } catch (e: unknown) {
      toast({ title: "Upload failed", description: String((e as Error)?.message ?? e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const prompt = [course.subject, course.topic, course.subtopic, course.title]
        .filter(Boolean)
        .join(" ");
      const res = await fetch("/api/course-background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { url?: string };
      if (!json.url) throw new Error("no_image");
      onPatch({ background_kind: "image", background_url: json.url });
      toast({ title: "Background generated" });
    } catch {
      toast({
        title: "AI background unavailable",
        description: "Upload an image or paste a link for now.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label className="text-slate-100">Course title</Label>
        <Input className={FIELD} value={course.title} onChange={(e) => onPatch({ title: e.target.value })} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label className="text-slate-100">Subject</Label>
          <Input className={FIELD} value={course.subject} onChange={(e) => onPatch({ subject: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label className="text-slate-100">Topic</Label>
          <Input className={FIELD} value={course.topic} onChange={(e) => onPatch({ topic: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label className="text-slate-100">Subtopic</Label>
          <Input className={FIELD} value={course.subtopic} onChange={(e) => onPatch({ subtopic: e.target.value })} />
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-slate-100">Description</Label>
        <textarea
          className={`${FIELD} w-full rounded-md border px-3 py-2 text-sm`}
          rows={3}
          value={course.description}
          onChange={(e) => onPatch({ description: e.target.value })}
        />
      </div>

      <div className="space-y-3 rounded-2xl border border-white/15 bg-white/5 p-4">
        <div className="flex items-center justify-between">
          <Label className="text-slate-100">Background</Label>
          {course.background_url && (
            <button
              type="button"
              className="text-xs text-slate-300 underline-offset-2 hover:underline"
              onClick={() => onPatch({ background_kind: "none", background_url: null })}
            >
              Remove
            </button>
          )}
        </div>

        <div className="h-28 overflow-hidden rounded-xl bg-slate-800">
          {preview && course.background_kind === "video" ? (
            <video src={preview} className="h-full w-full object-cover" muted loop autoPlay playsInline />
          ) : preview ? (
            <img src={preview} alt="Course background" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">No background yet</div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => imageInput.current?.click()}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ImageIcon className="mr-1.5 h-4 w-4" />}
            Upload image
          </Button>
          <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => videoInput.current?.click()}>
            <Video className="mr-1.5 h-4 w-4" /> Upload video
          </Button>
          <Button type="button" variant="secondary" size="sm" disabled={generating} onClick={generate}>
            {generating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
            AI generate
          </Button>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-slate-300">Or paste an image / video link</Label>
          <div className="flex gap-2">
            <Input
              className={FIELD}
              placeholder="https://…"
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                const value = (e.target as HTMLInputElement).value.trim();
                if (!value) return;
                const kind = /\.(mp4|webm|mov)(\?|$)/i.test(value) ? "video" : "image";
                onPatch({ background_kind: kind, background_url: value });
              }}
            />
            <Button type="button" variant="secondary" size="sm" className="shrink-0">
              <Upload className="mr-1.5 h-4 w-4" /> Enter
            </Button>
          </div>
        </div>

        <input
          ref={imageInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void upload(e.target.files?.[0], "image")}
        />
        <input
          ref={videoInput}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => void upload(e.target.files?.[0], "video")}
        />
      </div>
    </div>
  );
};

export default BackgroundEditor;

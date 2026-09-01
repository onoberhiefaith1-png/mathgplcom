// Tutorial video management for one page.
//
// Only a platform administrator or an Asset Manager ever reaches this dialog, and
// the database enforces the same rule. A page may hold several tutorials, so this
// is a small ordered list: add, retitle, replace, reorder, publish, remove.

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pageKeyLabel } from "@/lib/guides/pageKey";
import {
  addTutorial,
  removeTutorial,
  reorderTutorials,
  replaceTutorialVideo,
  tutorialVideoUrl,
  updateTutorial,
  type Tutorial,
} from "@/lib/guides/tutorials";
import { deletePageGuide, loadPageGuide } from "@/lib/guides/pageGuides";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageKey: string;
  tutorials: Tutorial[];
  onChanged: () => void;
}

const PageGuideManagerDialog = ({ open, onOpenChange, pageKey, tutorials, onChanged }: Props) => {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const addRef = useRef<HTMLInputElement | null>(null);
  const replaceRef = useRef<HTMLInputElement | null>(null);
  const [replacing, setReplacing] = useState<Tutorial | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(`How to use ${pageKeyLabel(pageKey)}`);
    setFile(null);
  }, [open, pageKey]);

  const run = async (label: string, task: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await task();
      onChanged();
      toast.success(label);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const add = () => {
    if (!file) {
      toast.error("Choose a video file first.");
      return;
    }
    void run("Tutorial added.", async () => {
      await addTutorial({ pageKey, title, file, status: "published" });
      setFile(null);
      setTitle(`How to use ${pageKeyLabel(pageKey)}`);
    });
  };

  const move = (index: number, delta: number) => {
    const next = [...tutorials];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    void run("Order updated.", () => reorderTutorials(next));
  };

  const drop = (tutorial: Tutorial) =>
    void run("Tutorial removed.", async () => {
      if (tutorial.legacy) {
        const legacy = await loadPageGuide(pageKey);
        if (legacy) await deletePageGuide(legacy);
        return;
      }
      await removeTutorial(tutorial);
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Tutorial videos</DialogTitle>
          <DialogDescription>
            {pageKeyLabel(pageKey)} · <span className="font-mono text-[11px]">{pageKey}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ul className="space-y-2">
            {tutorials.length === 0 && (
              <li className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                No tutorial uploaded for this page yet.
              </li>
            )}
            {tutorials.map((tutorial, index) => (
              <li key={tutorial.id} className="rounded-lg border border-border p-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{index + 1}.</span>
                  <Input
                    value={tutorial.title}
                    maxLength={120}
                    disabled={tutorial.legacy || busy}
                    onChange={(e) => {
                      const next = e.target.value;
                      void updateTutorial(tutorial.id, { title: next }).then(onChanged).catch(() => undefined);
                    }}
                    className="h-8 text-xs"
                  />
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={busy} onClick={() => move(index, -1)}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" disabled={busy} onClick={() => move(index, 1)}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    {!tutorial.legacy && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 text-[11px]"
                        disabled={busy}
                        onClick={() => {
                          setReplacing(tutorial);
                          replaceRef.current?.click();
                        }}
                      >
                        <Upload className="h-3.5 w-3.5" /> Replace
                      </Button>
                    )}
                    {!tutorial.legacy && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[11px]"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            tutorial.status === "published" ? "Unpublished." : "Published.",
                            () =>
                              updateTutorial(tutorial.id, {
                                status: tutorial.status === "published" ? "draft" : "published",
                              }),
                          )
                        }
                      >
                        {tutorial.status === "published" ? "Unpublish" : "Publish"}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      disabled={busy}
                      onClick={() => drop(tutorial)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {tutorialVideoUrl(tutorial.videoPath) && (
                  <video
                    src={tutorialVideoUrl(tutorial.videoPath) ?? undefined}
                    controls
                    preload="metadata"
                    className="mt-2 max-h-40 w-full rounded bg-black"
                  />
                )}
              </li>
            ))}
          </ul>

          <div className="space-y-2 rounded-lg border border-border p-3">
            <Label htmlFor="tutorial-title" className="text-xs">
              Add another tutorial
            </Label>
            <Input
              id="tutorial-title"
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              className="h-8 text-xs"
            />
            <input
              ref={addRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1" onClick={() => addRef.current?.click()}>
                <Upload className="h-3.5 w-3.5" /> Choose video
              </Button>
              <Button size="sm" onClick={add} disabled={busy || !file} className="gap-1">
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Add tutorial
              </Button>
              {file && <span className="text-[11px] text-muted-foreground">{file.name}</span>}
            </div>
          </div>
        </div>

        <input
          ref={replaceRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const picked = e.target.files?.[0];
            const target = replacing;
            e.target.value = "";
            setReplacing(null);
            if (!picked || !target) return;
            void run("Video replaced.", () => replaceTutorialVideo(target, picked));
          }}
        />

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PageGuideManagerDialog;

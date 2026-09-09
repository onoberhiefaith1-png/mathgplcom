/**
 * ADD TO BUILDING — hangs work that already exists on a named frame in a
 * building.
 *
 * This is a SHORTCUT, never a copy: the course, assignment or adventure stays
 * exactly where it is, and removing the shortcut later leaves the original
 * completely untouched. It sits beside Guest link, which is unchanged: a guest
 * link is for people outside the school, while this is for the signed-in
 * learners who walk the building.
 *
 * The teacher chooses a building they can edit, then the frame by NAME — which
 * is why frame names are unique — and nothing else. No new frame is ever
 * created here, so the building's walls stay exactly as they were designed.
 */
import { useEffect, useState } from "react";
import { Building2, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { listBuildings, canEditBuilding } from "@/lib/building/api";
import { addFrameLink, listFrameLinks, listFrames, type BuildingFrame } from "@/lib/building/frames";
import type { Building } from "@/lib/building/types";
import type { AcademyProductKind } from "@/lib/academy/types";
import { useAccount } from "@/lib/accounts/useAccount";

export interface AddToBuildingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What kind of work is being placed on the wall. */
  contentKind: AcademyProductKind;
  contentId: string;
  /** Shown so the teacher can see what they are placing. */
  contentTitle: string;
}

const AddToBuildingDialog = ({
  open,
  onOpenChange,
  contentKind,
  contentId,
  contentTitle,
}: AddToBuildingDialogProps) => {
  const { orgId } = useAccount();
  const [loading, setLoading] = useState(false);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [frames, setFrames] = useState<BuildingFrame[]>([]);
  const [alreadyOn, setAlreadyOn] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<string | null>(null);

  // Only buildings this person may edit can be offered.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setBuildingId(null);
    setFrames([]);
    void (async () => {
      try {
        const all = await listBuildings(orgId ?? null);
        const editable: Building[] = [];
        for (const b of all) {
          if (await canEditBuilding(b.id)) editable.push(b);
        }
        if (alive) setBuildings(editable);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, orgId]);

  // The frames already built in the chosen building, by name.
  useEffect(() => {
    if (!buildingId) return;
    let alive = true;
    setLoading(true);
    void (async () => {
      try {
        const [all, links] = await Promise.all([
          listFrames(buildingId),
          listFrameLinks(buildingId),
        ]);
        if (!alive) return;
        setFrames(all.filter((f) => (f.kind ?? "frame") === "frame"));
        setAlreadyOn(
          new Set(
            links
              .filter((l) => l.content_kind === contentKind && l.content_id === contentId)
              .map((l) => l.frame_id),
          ),
        );
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [buildingId, contentKind, contentId]);

  const place = async (frame: BuildingFrame) => {
    setSaving(frame.id);
    try {
      const position = alreadyOn.size + frames.length;
      await addFrameLink(frame.id, contentKind, contentId, position);
      setAlreadyOn((prev) => new Set(prev).add(frame.id));
      toast({
        title: "Added to the building",
        description: `“${contentTitle}” now opens from the frame “${frame.name}”.`,
      });
    } catch (err) {
      toast({
        title: "It could not be added",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add to a building</DialogTitle>
          <DialogDescription>
            Choose a building, then the frame it should appear on. Nothing is copied —
            “{contentTitle}” stays exactly where it is.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && !buildingId && (
          <div className="space-y-1.5">
            {buildings.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBuildingId(b.id)}
                className="flex w-full items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <Building2 className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">{b.name}</span>
              </button>
            ))}
            {buildings.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">
                You do not have a building you can edit yet.
              </p>
            )}
          </div>
        )}

        {!loading && buildingId && (
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => setBuildingId(null)}
              className="text-[11px] text-muted-foreground underline"
            >
              Choose a different building
            </button>
            {frames.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm">{f.name}</span>
                {alreadyOn.has(f.id) ? (
                  <span className="text-[11px] text-muted-foreground">Already there</span>
                ) : (
                  <Button size="sm" disabled={saving === f.id} onClick={() => void place(f)}>
                    {saving === f.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
                  </Button>
                )}
              </div>
            ))}
            {frames.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">
                This building has no frames yet. Build one on a wall first, give it a name,
                then come back here.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AddToBuildingDialog;

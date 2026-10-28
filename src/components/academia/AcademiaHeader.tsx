import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import MediaImg from "./MediaImg";
import ThumbnailPicker from "./ThumbnailPicker";
import { updateAcademia, type AcademiaPresentation, type AcademiaRow } from "@/lib/academia/api";
import { initialsOf } from "@/lib/accounts/avatar";

/**
 * The school's learning identity: the same header for the School and for every
 * teacher in its Shared Workspace. Only the owner (`canEdit`) can change it.
 */
const AcademiaHeader = ({
  academia,
  ownerName,
  canEdit,
  queryKey,
}: {
  academia: AcademiaRow & AcademiaPresentation;
  ownerName: string;
  canEdit: boolean;
  queryKey: unknown[];
}) => {
  const qc = useQueryClient();
  const [picking, setPicking] = useState<null | "cover" | "logo">(null);
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(academia.description ?? "");

  const save = async (patch: AcademiaPresentation) => {
    try {
      await updateAcademia(academia.id, patch as Partial<AcademiaRow>);
      await qc.invalidateQueries({ queryKey });
    } catch (e) {
      toast.error((e as Error).message || "That didn't save.");
    }
  };

  return (
    <section className="relative mb-5 overflow-hidden rounded-3xl border border-border bg-card">
      <div className="relative h-36 w-full bg-gradient-to-br from-primary/25 via-card to-background sm:h-44">
        <MediaImg path={academia.cover_path} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
        {canEdit && (
          <button
            type="button"
            onClick={() => setPicking("cover")}
            className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs backdrop-blur hover:border-primary/50"
          >
            <Camera className="h-3.5 w-3.5" /> Change cover
          </button>
        )}
      </div>
      <div className="relative -mt-12 flex flex-wrap items-end gap-4 px-5 pb-5">
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => setPicking("logo")}
          className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-primary/60 bg-background shadow-lg"
          aria-label={canEdit ? "Change Academia picture" : undefined}
        >
          <MediaImg
            path={academia.presentation_path}
            className="h-full w-full object-cover"
            fallback={<span className="flex h-full w-full items-center justify-center text-2xl font-semibold text-primary">{initialsOf(ownerName)}</span>}
          />
          {canEdit && <Camera className="absolute bottom-1 right-1 h-4 w-4 rounded bg-background/80 p-0.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.2em] text-primary">{ownerName}</p>
          <h1 className="truncate text-2xl font-semibold">{academia.name}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {academia.description || (canEdit ? "Add a short description of your Academia." : "")}
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              setDesc(academia.description ?? "");
              setEditing(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Pencil className="h-4 w-4" /> Edit presentation
          </button>
        )}
      </div>

      {canEdit && picking && (
        <ThumbnailPicker
          open
          onOpenChange={(v) => !v && setPicking(null)}
          academiaId={academia.id}
          label={picking === "cover" ? "cover" : "presentation"}
          title={picking === "cover" ? "Academia cover" : "Academia picture"}
          context={{ topic: `${academia.name} — a school learning academy` }}
          onPicked={(path) => save(picking === "cover" ? { cover_path: path } : { presentation_path: path })}
        />
      )}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Academia description</DialogTitle>
          </DialogHeader>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={4}
            maxLength={500}
            className="w-full rounded-lg border border-input bg-background p-3 text-sm"
          />
          <button
            type="button"
            onClick={async () => {
              await save({ description: desc.trim() || null });
              setEditing(false);
            }}
            className="justify-self-end rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Save
          </button>
        </DialogContent>
      </Dialog>
    </section>
  );
};
export default AcademiaHeader;

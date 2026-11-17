import { useState } from "react";
import { Loader2, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AcademiaDuplicateItem } from "@/components/academia/AcademiaDuplicateMenu";
import { deleteAcademiaItem, renameAcademiaItem, type AcademiaCatalogKind } from "@/lib/academia/api";
import { academiaNameError, canManageAcademiaItem, trimmedAcademiaName } from "@/lib/academia/itemPermissions";

export type AcademiaItemMenuProps = {
  kind: AcademiaCatalogKind;
  id: string;
  name: string;
  createdBy?: string | null;
  userId?: string | null;
  isOrgOwner?: boolean;
};

const KIND_LABEL: Record<AcademiaCatalogKind, string> = {
  class: "Class",
  subject: "Subject",
  topic: "Topic",
  subtopic: "Subtopic",
  session: "Session",
};

async function refreshCatalog(qc: ReturnType<typeof useQueryClient>) {
  await Promise.allSettled([
    qc.invalidateQueries({ queryKey: ["academia-tree"] }),
    qc.invalidateQueries({ queryKey: ["academia-sessions"] }),
    qc.invalidateQueries({ queryKey: ["academia-mine"] }),
    qc.invalidateQueries({ predicate: query => String(query.queryKey[0]).includes("mcq") }),
  ]);
}

/**
 * Settings ⋯ for one catalog item. Shown only to the school owner, or to the
 * teacher who created a topic / subtopic / session. The menu is always
 * Duplicate, Rename and Delete — never a standalone trash control, and never
 * View Questions (that stays a separate button so it cannot reveal ⋯ on
 * items a teacher does not own).
 */
export default function AcademiaItemMenu({
  kind, id, name, createdBy, userId, isOrgOwner = false,
}: AcademiaItemMenuProps) {
  const qc = useQueryClient();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const canManage = canManageAcademiaItem({ kind, isOrgOwner, userId, createdBy });
  if (!canManage) return null;

  const label = KIND_LABEL[kind];
  const stop = (event: React.SyntheticEvent) => event.stopPropagation();

  const openRename = () => {
    setDraft(name);
    setError(null);
    setRenaming(true);
  };

  const saveName = async () => {
    const message = academiaNameError(draft, "name");
    if (message) { setError(message); return; }
    const next = trimmedAcademiaName(draft);
    if (next === name) { setRenaming(false); return; }
    setSaving(true);
    try {
      await renameAcademiaItem(kind, id, next);
      toast.success(`Renamed to ${next}`);
      await refreshCatalog(qc);
      setRenaming(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not rename this item.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (deleting) return;
    if (!confirm(`Remove "${name}" and everything inside it?`)) return;
    setDeleting(true);
    try {
      await deleteAcademiaItem(kind, id);
      toast.success(`Removed ${name}`);
      await refreshCatalog(qc);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove this item.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <span onClick={stop} onPointerDown={stop} onKeyDown={stop}>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`${label} settings for ${name}`}
          data-academia-item-menu={kind}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-current opacity-80 hover:bg-foreground/10 hover:opacity-100 md:h-7 md:w-7"
        >
          <MoreVertical className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={stop} className="min-w-44">
          <AcademiaDuplicateItem kind={kind} id={id} name={name} />
          <DropdownMenuItem onSelect={() => openRename()} aria-label={`Rename ${name}`}>
            <Pencil className="mr-2 h-4 w-4" /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={deleting}
            onSelect={event => { event.preventDefault(); void remove(); }}
            aria-label={`Delete ${name}`}
            className="text-destructive focus:text-destructive"
          >
            {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            {deleting ? "Removing…" : "Delete"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renaming} onOpenChange={open => { if (!saving) setRenaming(open); }}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-md sm:rounded-lg" onClick={stop} onPointerDown={stop}>
          <DialogHeader>
            <DialogTitle>Rename {label.toLowerCase()}</DialogTitle>
          </DialogHeader>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium">{label} name</span>
            <input
              value={draft}
              onChange={e => { setDraft(e.target.value); setError(null); }}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void saveName(); } }}
              autoFocus
              maxLength={200}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "academia-rename-error" : undefined}
              className="min-h-11 rounded-lg border border-input bg-background px-3 py-2 text-base md:min-h-0 md:text-sm"
            />
          </label>
          {error && <p id="academia-rename-error" role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" disabled={saving} onClick={() => setRenaming(false)} className="min-h-11 rounded-lg border border-border px-4 text-sm md:min-h-0 md:py-2">
              Cancel
            </button>
            <button type="button" disabled={saving} onClick={() => void saveName()} className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground md:min-h-0 md:py-2">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </span>
  );
}

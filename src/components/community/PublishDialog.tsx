import { useEffect, useState } from "react";
import { Loader2, Share2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import UsernameDialog from "./UsernameDialog";
import { findMyPublication, publishResource, setResourceStatus } from "@/lib/community/community";
import { KIND_LABEL, parseHashtags, type CommunityKind } from "@/lib/community/types";
import { useCommunityIdentity } from "@/lib/community/useCommunity";

/**
 * One publish surface reused by every resource type: lesson notes, classes,
 * adventures, backgrounds, buildings and assets.
 */
const PublishDialog = ({
  open,
  onOpenChange,
  kind,
  sourceId,
  defaultTitle,
  defaultDescription,
  defaultHashtags,
  payload,
  onPublished,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  kind: CommunityKind;
  sourceId: string | null;
  defaultTitle: string;
  defaultDescription?: string;
  defaultHashtags?: string;
  payload?: Record<string, unknown>;
  onPublished?: () => void;
}) => {
  const { username, refetch } = useCommunityIdentity();
  const [askUsername, setAskUsername] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription ?? "");
  const [tags, setTags] = useState(defaultHashtags ?? "");
  const [busy, setBusy] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [existingStatus, setExistingStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(defaultTitle);
    setDescription(defaultDescription ?? "");
    setTags(defaultHashtags ?? "");
    if (!sourceId) { setExistingId(null); setExistingStatus(null); return; }
    void findMyPublication(kind, sourceId).then((row) => {
      setExistingId(row?.id ?? null);
      setExistingStatus(row?.status ?? null);
    });
  }, [open, kind, sourceId, defaultTitle, defaultDescription, defaultHashtags]);

  const publish = async () => {
    if (!username) { setAskUsername(true); return; }
    if (!title.trim()) {
      toast({ title: "Add a title", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await publishResource({
        kind,
        sourceId,
        title,
        description,
        hashtags: parseHashtags(tags),
        payload,
      });
      toast({
        title: "Shared with MathGPL Community",
        description: `Your ${KIND_LABEL[kind].toLowerCase()} is now discoverable.`,
      });
      onPublished?.();
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Could not publish", description: String((e as Error)?.message ?? e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const unpublish = async () => {
    if (!existingId) return;
    setBusy(true);
    try {
      await setResourceStatus(existingId, "unpublished");
      toast({
        title: "Removed from Community",
        description: "Nobody new can download it. Existing copies stay with their owners.",
      });
      onPublished?.();
      onOpenChange(false);
    } catch (e) {
      toast({ title: "Could not unpublish", description: String((e as Error)?.message ?? e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-4 w-4" /> Share with MathGPL Community
            </DialogTitle>
            <DialogDescription>
              Other members can discover this {KIND_LABEL[kind].toLowerCase()} and copy it into their own
              workspace. Their copy is independent — editing it never changes yours.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Field label="Title">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 outline-hidden focus:border-primary"
              />
            </Field>
            <Field label="Description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="What does it cover? Which class is it for?"
                className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 outline-hidden focus:border-primary"
              />
            </Field>
            <Field label="Hashtags">
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="#Mathematics #Algebra #JSS2"
                className="w-full rounded-md border border-border bg-background px-3 py-2 outline-hidden focus:border-primary"
              />
            </Field>
            <p className="text-xs text-muted-foreground">
              Publishing as {username ? <span className="font-semibold">@{username}</span> : "a new creator — you'll pick a username next"}.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {existingId && existingStatus === "published" && (
              <Button variant="outline" onClick={unpublish} disabled={busy} className="gap-2 mr-auto">
                <Undo2 className="h-4 w-4" /> Unpublish
              </Button>
            )}
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={publish} disabled={busy} className="gap-2">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {existingId ? "Update listing" : "Publish"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <UsernameDialog
        open={askUsername}
        onOpenChange={setAskUsername}
        onDone={() => { void refetch(); }}
      />
    </>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block space-y-1.5">
    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
    {children}
  </label>
);

export default PublishDialog;

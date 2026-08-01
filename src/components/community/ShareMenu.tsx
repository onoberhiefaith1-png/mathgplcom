/**
 * The one "⋯" menu every owned item carries.
 *
 * First entry is always "Share with Community". When the item is already
 * published the menu offers "Update listing" and "Unpublish" instead, and the
 * card can show a small Shared badge. Surface-specific actions (rename,
 * duplicate, regenerate…) are passed as `items`, delete as `onDelete`.
 */
import { useCallback, useEffect, useState, type ComponentType } from "react";
import { Globe2, MoreVertical, Share2, Trash2, Undo2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import PublishDialog from "./PublishDialog";
import { findMyPublication, setResourceStatus } from "@/lib/community/community";
import type { CommunityKind } from "@/lib/community/types";
import { useCommunityMode } from "@/lib/community/mode";
import { useCommunityRights } from "@/lib/community/useCommunity";
import { cn } from "@/lib/utils";

export interface ShareMenuAction {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  onClick: () => void;
  destructive?: boolean;
}

export interface ShareMenuProps {
  kind: CommunityKind;
  sourceId: string;
  title: string;
  description?: string;
  hashtags?: string;
  payload?: Record<string, unknown>;
  /** Surface-specific entries listed under the community block. */
  items?: ShareMenuAction[];
  onDelete?: () => void;
  deleteLabel?: string;
  /** Runs after publish/unpublish so the surface can refresh its own flags. */
  onShareChange?: (shared: boolean) => void;
  className?: string;
  triggerClassName?: string;
  align?: "start" | "end";
}

const ShareMenu = ({
  kind,
  sourceId,
  title,
  description,
  hashtags,
  payload,
  items,
  onDelete,
  deleteLabel = "Delete",
  onShareChange,
  className,
  triggerClassName,
  align = "end",
}: ShareMenuProps) => {
  const { isCommunity } = useCommunityMode();
  const { canPublish } = useCommunityRights();
  const [open, setOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [pubId, setPubId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const allowShare = canPublish && !isCommunity;

  const refresh = useCallback(async () => {
    if (!allowShare || !sourceId) return;
    try {
      const row = await findMyPublication(kind, sourceId);
      setPubId(row && row.status === "published" ? row.id : null);
    } catch {
      setPubId(null);
    }
  }, [allowShare, kind, sourceId]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const unpublish = async () => {
    if (!pubId) return;
    setBusy(true);
    try {
      await setResourceStatus(pubId, "unpublished");
      setPubId(null);
      onShareChange?.(false);
      toast({
        title: "Removed from Community",
        description: "Existing copies stay with their owners.",
      });
    } catch (e) {
      toast({
        title: "Could not unpublish",
        description: String((e as Error)?.message ?? e),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("relative", className)} onClick={(e) => e.stopPropagation()}>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="More actions"
            className={cn(
              "grid h-8 w-8 place-items-center rounded-full border border-border/50 bg-background/80 text-foreground backdrop-blur transition hover:bg-background",
              triggerClassName,
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-52">
          {allowShare && (
            <>
              <DropdownMenuItem onClick={() => setPublishOpen(true)}>
                {pubId ? (
                  <>
                    <Globe2 className="mr-2 h-4 w-4" /> Update listing
                  </>
                ) : (
                  <>
                    <Share2 className="mr-2 h-4 w-4" /> Share with Community
                  </>
                )}
              </DropdownMenuItem>
              {pubId && (
                <DropdownMenuItem disabled={busy} onClick={() => void unpublish()}>
                  <Undo2 className="mr-2 h-4 w-4" /> Unpublish
                </DropdownMenuItem>
              )}
              {(items?.length || onDelete) && <DropdownMenuSeparator />}
            </>
          )}

          {items?.map((a) => (
            <DropdownMenuItem
              key={a.label}
              onClick={a.onClick}
              className={a.destructive ? "text-destructive focus:text-destructive" : undefined}
            >
              {a.icon && <a.icon className="mr-2 h-4 w-4" />}
              {a.label}
            </DropdownMenuItem>
          ))}

          {onDelete && (
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
              <Trash2 className="mr-2 h-4 w-4" /> {deleteLabel}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {publishOpen && (
        <PublishDialog
          open
          onOpenChange={(o) => {
            if (!o) setPublishOpen(false);
          }}
          kind={kind}
          sourceId={sourceId}
          defaultTitle={title}
          defaultDescription={description}
          defaultHashtags={hashtags}
          payload={payload}
          onPublished={() => {
            void refresh();
            onShareChange?.(true);
          }}
        />
      )}
    </div>
  );
};

export default ShareMenu;

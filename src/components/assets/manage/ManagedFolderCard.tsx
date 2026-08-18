// A folder card on the Assets pages. The ⋮ menu only renders for asset
// managers; everyone else sees a plain folder.

import { MoreVertical } from "lucide-react";
import { Link } from "@/lib/router-compat";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import FolderCover from "./FolderCover";

interface Props {
  name: string;
  description?: string | null;
  icon?: string | null;
  imageUrl?: string | null;
  countLabel?: string;
  active?: boolean;
  to: string;
  manager?: boolean;
  onEdit?: () => void;
  onToggleActive?: () => void;
  onDelete?: () => void;
}

const ManagedFolderCard = ({
  name, description, icon, imageUrl, countLabel, active = true, to,
  manager = false, onEdit, onToggleActive, onDelete,
}: Props) => (
  <div className="group relative overflow-hidden rounded-xl border border-border/40 bg-background/50 backdrop-blur transition hover:border-primary/60 hover:bg-background/70">
    <Link to={to} className="block">
      <div className="flex h-28 items-center justify-center overflow-hidden bg-background/30">
        <FolderCover value={imageUrl} icon={icon} name={name} />
      </div>
      <div className="p-4 text-center">
        <div className="truncate text-base font-semibold">{name}</div>
        {countLabel && <div className="text-xs text-muted-foreground">{countLabel}</div>}
        {description && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{description}</p>
        )}
        {!active && (
          <span className="mt-2 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Inactive
          </span>
        )}
      </div>
    </Link>

    {manager && (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Actions for ${name}`}
            className="absolute right-2 top-2 rounded-full bg-foreground/70 p-1.5 text-background opacity-0 transition group-hover:opacity-100 focus:opacity-100"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link to={to}>Open</Link>
          </DropdownMenuItem>
          {onEdit && (
            <DropdownMenuItem onClick={onEdit}>Edit name, cover &amp; description</DropdownMenuItem>
          )}
          {onToggleActive && (
            <DropdownMenuItem onClick={onToggleActive}>
              {active ? "Deactivate" : "Activate"}
            </DropdownMenuItem>
          )}
          {onDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    )}
  </div>
);

export default ManagedFolderCard;

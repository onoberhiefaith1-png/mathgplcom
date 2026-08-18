// One Session / Sub-Session card with its ⋮ actions menu.

import { MoreVertical } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  name: string;
  description?: string | null;
  icon?: string | null;
  imageUrl?: string | null;
  countLabel: string;
  active: boolean;
  to: string;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}

const GplFolderCard = ({
  name, description, icon, imageUrl, countLabel, active, to,
  onEdit, onToggleActive, onDelete,
}: Props) => (
  <div className="group relative overflow-hidden rounded-2xl border border-dash-surface/15 bg-dash-surface/5 backdrop-blur transition hover:border-dash-gold/50">
    <Link to={to} className="block">
      <div className="flex h-28 items-center justify-center overflow-hidden bg-dash-surface/10">
        {imageUrl ? (
          <img src={imageUrl} alt={name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="text-4xl leading-none">{icon || "📁"}</span>
        )}
      </div>
      <div className="p-4">
        <p className="truncate text-sm font-semibold text-dash-surface">{name}</p>
        <p className="mt-0.5 text-xs text-dash-surface/60">{countLabel}</p>
        {description && (
          <p className="mt-1 line-clamp-2 text-xs text-dash-surface/50">{description}</p>
        )}
        {!active && (
          <span className="mt-2 inline-block rounded-full bg-dash-surface/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-dash-surface/70">
            Inactive
          </span>
        )}
      </div>
    </Link>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Actions for ${name}`}
          className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link to={to}>Open</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
        <DropdownMenuItem onClick={onToggleActive}>
          {active ? "Deactivate" : "Activate"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive" onClick={onDelete}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);

export default GplFolderCard;

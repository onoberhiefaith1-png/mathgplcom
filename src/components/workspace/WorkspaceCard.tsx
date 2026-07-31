import { Link } from "@/lib/router-compat";
import type { LucideIcon } from "lucide-react";

export type WorkspaceTile = {
  to: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  /** Tailwind gradient + border + text accent classes. */
  accent: string;
  /** Optional artwork rendered behind the card content. */
  image?: string;
  imageAlt?: string;
};

/**
 * One card shape shared by Teaching Hub and MathGPL Live so both
 * workspaces feel like the same application.
 */
const WorkspaceCard = ({ tile }: { tile: WorkspaceTile }) => {
  const { to, label, description, icon: Icon, accent, image, imageAlt } = tile;
  return (
    <Link
      to={to}
      className={`group relative flex h-44 flex-col justify-between overflow-hidden rounded-2xl border bg-gradient-to-br ${accent} p-6 backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-2xl`}
    >
      {image && (
        <>
          <img
            src={image}
            alt={imageAlt ?? ""}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent" />
        </>
      )}
      <Icon className="relative h-8 w-8 drop-shadow" />
      <div className="relative">
        <div className="text-2xl font-semibold tracking-tight">{label}</div>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    </Link>
  );
};

export default WorkspaceCard;

import { Link } from "@/lib/router-compat";
import type { LucideIcon } from "lucide-react";
import {
  SECTION_CARD_CLASS,
  sectionCardStyle,
  type SectionThemeKey,
} from "@/lib/theme/sectionThemes";

export type WorkspaceTile = {
  to: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  /** Module identity from the shared section theme registry. */
  theme: SectionThemeKey;
  /** Optional artwork rendered behind the card content. */
  image?: string;
  imageAlt?: string;
};

/**
 * One premium card shape shared by Teaching Hub and MathGPL Live so both
 * workspaces feel like the same application.
 */
const WorkspaceCard = ({ tile }: { tile: WorkspaceTile }) => {
  const { to, label, description, icon: Icon, theme, image, imageAlt } = tile;
  return (
    <Link
      to={to}
      className={`${SECTION_CARD_CLASS} flex h-44 flex-col justify-between p-6`}
      style={sectionCardStyle(theme)}
    >
      {image && (
        <img
          src={image}
          alt={imageAlt ?? ""}
          className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover opacity-70 transition duration-700 group-hover:scale-105"
          loading="lazy"
        />
      )}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ backgroundImage: "var(--section-scrim)" }}
      />
      <Icon className="relative h-8 w-8 text-section-ink drop-shadow" />
      <div className="relative">
        <div className="text-2xl font-semibold tracking-tight text-section-ink drop-shadow-sm">{label}</div>
        {description && (
          <p className="mt-1 text-xs text-section-ink-muted">{description}</p>
        )}
      </div>
    </Link>
  );
};

export default WorkspaceCard;

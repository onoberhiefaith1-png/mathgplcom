import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Link } from "@/lib/router-compat";
import {
  SECTION_CARD_CLASS,
  sectionCardStyle,
  type SectionThemeKey,
} from "@/lib/theme/sectionThemes";

export interface SectionCardProps {
  theme?: SectionThemeKey;
  label: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  /** Optional artwork behind the gradient. */
  image?: string;
  imageAlt?: string;
  to?: string;
  onClick?: () => void;
  className?: string;
  /** Extra content rendered under the description. */
  children?: ReactNode;
}

/**
 * The premium themed card used by every major section of MathGPL: a gradient
 * surface with its own module identity, a readability scrim under the text and
 * a soft light sheen. Replaces the plain white content cards.
 */
const SectionCard = ({
  theme = "neutral",
  label,
  description,
  icon: Icon,
  image,
  imageAlt,
  to,
  onClick,
  className = "",
  children,
}: SectionCardProps) => {
  const body = (
    <>
      {image && (
        <img
          src={image}
          alt={imageAlt ?? ""}
          loading="lazy"
          className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover opacity-70 transition duration-700 group-hover:scale-105"
        />
      )}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ backgroundImage: "var(--section-scrim)" }}
      />
      {Icon && (
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-section-ink/15 text-section-ink shadow-inner backdrop-blur transition-transform duration-300 group-hover:scale-110">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <div className="mt-4 text-lg font-semibold tracking-tight text-section-ink drop-shadow-sm sm:text-xl">
        {label}
      </div>
      {description && (
        <p className="mt-1 text-xs leading-relaxed text-section-ink-muted sm:text-sm">
          {description}
        </p>
      )}
      {children}
    </>
  );

  const shared = `${SECTION_CARD_CLASS} block min-h-[44px] p-5 text-left ${className}`;
  const style = sectionCardStyle(theme);

  if (to) {
    return (
      <Link to={to} className={shared} style={style}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${shared} w-full`} style={style}>
        {body}
      </button>
    );
  }
  return (
    <div className={shared} style={style}>
      {body}
    </div>
  );
};

export default SectionCard;

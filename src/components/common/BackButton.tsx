import { ArrowLeft } from "lucide-react";
import { CSSProperties, ReactNode } from "react";
import { useNavHistory } from "@/lib/nav/NavHistory";

type Props = {
  fallback?: string;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  title?: string;
  children?: ReactNode;
  iconClassName?: string;
  onClick?: () => void;
};

/**
 * App-wide Back button that walks the real navigation stack (D→C→B→A),
 * not the raw browser history which can accumulate duplicate pushes.
 */
export const BackButton = ({
  fallback,
  className,
  style,
  ariaLabel = "Back",
  title,
  children,
  iconClassName = "h-4 w-4",
  onClick,
}: Props) => {
  const { goBack } = useNavHistory();
  return (
    <button
      type="button"
      onClick={() => {
        onClick?.();
        goBack(fallback);
      }}
      className={className}
      style={style}
      aria-label={ariaLabel}
      title={title ?? ariaLabel}
    >
      <ArrowLeft className={iconClassName} />
      {children}
    </button>
  );
};

export default BackButton;

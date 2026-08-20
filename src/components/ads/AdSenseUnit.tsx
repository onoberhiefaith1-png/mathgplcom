import { useEffect, useRef, useState } from "react";
import { ADSENSE_CLIENT, loadAdSenseScript } from "@/lib/ads/adsense";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * One Google AdSense display unit.
 *
 * Rendered client-side only (the AdSense script rewrites the <ins> element, so
 * SSR markup would never match hydration). The unit reports whether Google
 * filled it, letting the parent hide an unfilled block instead of leaving a
 * blank space on the page.
 */
const AdSenseUnit = ({
  slotId,
  className,
  style,
  format = "auto",
  onFilled,
}: {
  slotId: string;
  className?: string;
  style?: React.CSSProperties;
  format?: string;
  onFilled?: (filled: boolean) => void;
}) => {
  const ref = useRef<HTMLModElement | null>(null);
  const pushed = useRef(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || pushed.current || !ref.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // A blocked or not-yet-loaded script must never break the page.
    }
    // Google marks the element with data-ad-status once it decides.
    const el = ref.current;
    const observer = new MutationObserver(() => {
      const status = el.getAttribute("data-ad-status");
      if (status) onFilled?.(status === "filled");
    });
    observer.observe(el, { attributes: true, attributeFilter: ["data-ad-status"] });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, slotId]);

  if (!mounted || !slotId) return null;

  return (
    <ins
      ref={ref}
      className={`adsbygoogle block ${className ?? ""}`}
      style={{ display: "block", ...style }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={slotId}
      data-ad-format={format}
      data-full-width-responsive="true"
    />
  );
};

export default AdSenseUnit;

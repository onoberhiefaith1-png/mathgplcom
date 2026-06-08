// useAutoHide — visibility flag that hides after `ms` of inactivity and
// re-shows whenever `ping()` is called. Used by the floating panels and
// arithmetic toolbar (5-second classroom default).

import { useCallback, useEffect, useRef, useState } from "react";

export const useAutoHide = (ms = 10000) => {
  const [visible, setVisible] = useState(true);
  const timer = useRef<number | null>(null);

  const ping = useCallback(() => {
    setVisible(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setVisible(false), ms);
  }, [ms]);

  useEffect(() => {
    ping();
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [ping]);

  return { visible, ping };
};

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_FLOATING_STYLE,
  sanitizeFloatingStyle,
  type FloatingDisplayStyleId,
} from "@/lib/smartboard/floatingDisplayStyles";
import {
  getFloatingDisplayStyle,
  setMyFloatingDisplayStyle,
  setPlatformFloatingDisplayStyle,
} from "@/lib/smartboard/floatingDisplay.functions";

const CACHE_KEY = "mathgpl.floatingDisplayStyle";

const cached = (): FloatingDisplayStyleId => {
  try {
    return sanitizeFloatingStyle(window.localStorage.getItem(CACHE_KEY));
  } catch { return DEFAULT_FLOATING_STYLE; }
};

export interface FloatingDisplayStyleApi {
  /** The design the board must render right now. */
  style: FloatingDisplayStyleId;
  platformDefault: FloatingDisplayStyleId;
  userChoice: FloatingDisplayStyleId | null;
  isAdmin: boolean;
  saving: boolean;
  chooseForMe: (style: FloatingDisplayStyleId) => Promise<void>;
  setPlatformDefault: (style: FloatingDisplayStyleId) => Promise<void>;
  /** Fall back to whatever the administrator has set. */
  useePlatformDefault: () => Promise<void>;
}

/** Resolves userChoice ?? platformDefault ?? "original", with an instant
 *  localStorage first paint so the board never flickers. */
export const useFloatingDisplayStyle = (): FloatingDisplayStyleApi => {
  const [state, setState] = useState<{
    platformDefault: FloatingDisplayStyleId;
    userChoice: FloatingDisplayStyleId | null;
    isAdmin: boolean;
    saving: boolean;
  }>(() => ({
    platformDefault: typeof window === "undefined" ? DEFAULT_FLOATING_STYLE : cached(),
    userChoice: null,
    isAdmin: false,
    saving: false,
  }));

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await getFloatingDisplayStyle();
        if (!alive) return;
        const { data: auth } = await supabase.auth.getUser();
        let isAdmin = false;
        if (auth.user) {
          const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", auth.user.id);
          isAdmin = (roles ?? []).some((r) => r.role === "platform_owner" || r.role === "co_admin");
        }
        if (!alive) return;
        setState((s) => ({ ...s, platformDefault: res.platformDefault, userChoice: res.userChoice, isAdmin }));
        try { window.localStorage.setItem(CACHE_KEY, res.userChoice ?? res.platformDefault); } catch { /* noop */ }
      } catch { /* signed-out or offline: keep the cached style */ }
    })();
    return () => { alive = false; };
  }, []);

  const chooseForMe = useCallback(async (style: FloatingDisplayStyleId) => {
    setState((s) => ({ ...s, saving: true, userChoice: style }));
    try { window.localStorage.setItem(CACHE_KEY, style); } catch { /* noop */ }
    try { await setMyFloatingDisplayStyle({ data: { style } }); }
    finally { setState((s) => ({ ...s, saving: false })); }
  }, []);

  const setPlatformDefault = useCallback(async (style: FloatingDisplayStyleId) => {
    setState((s) => ({ ...s, saving: true, platformDefault: style }));
    try { await setPlatformFloatingDisplayStyle({ data: { style } }); }
    finally { setState((s) => ({ ...s, saving: false })); }
  }, []);

  const useePlatformDefault = useCallback(async () => {
    setState((s) => ({ ...s, saving: true, userChoice: null }));
    try { window.localStorage.removeItem(CACHE_KEY); } catch { /* noop */ }
    try { await setMyFloatingDisplayStyle({ data: { style: "" } }); }
    finally { setState((s) => ({ ...s, saving: false })); }
  }, []);

  return {
    style: state.userChoice ?? state.platformDefault ?? DEFAULT_FLOATING_STYLE,
    platformDefault: state.platformDefault,
    userChoice: state.userChoice,
    isAdmin: state.isAdmin,
    saving: state.saving,
    chooseForMe,
    setPlatformDefault,
    useePlatformDefault,
  };
};

export default useFloatingDisplayStyle;

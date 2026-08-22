import { createContext, useCallback, useContext, useEffect, useRef, ReactNode } from "react";
import { useLocation, useNavigate, useNavigationType } from "@/lib/router-compat";

type NavHistoryCtx = {
  canGoBack: () => boolean;
  goBack: (fallback?: string) => void;
  /** Steps forward in browser history, when the user has gone back before. */
  goForward: () => void;
};


const Ctx = createContext<NavHistoryCtx | null>(null);

export const NavHistoryProvider = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const navType = useNavigationType(); // "PUSH" | "POP" | "REPLACE"
  const navigate = useNavigate();
  const stackRef = useRef<string[]>([]);

  useEffect(() => {
    const key = location.pathname + location.search;
    const stack = stackRef.current;
    const top = stack[stack.length - 1];

    if (navType === "POP") {
      // Browser back/forward: drop the top entry (if it matches previous top,
      // we're just resyncing).
      if (stack.length > 0) stack.pop();
      // If we popped past our known top, keep stack aligned with current key.
      if (stack[stack.length - 1] !== key && stack.length === 0) {
        stack.push(key);
      }
    } else if (navType === "REPLACE") {
      if (stack.length === 0) stack.push(key);
      else stack[stack.length - 1] = key;
    } else {
      // PUSH — but ignore no-op re-pushes of the same location.
      if (top !== key) stack.push(key);
    }
  }, [location, navType]);

  const canGoBack = useCallback(() => stackRef.current.length > 1, []);

  const goBack = useCallback(
    (fallback?: string) => {
      if (stackRef.current.length > 1) {
        // The POP effect is the single owner of stack mutation. Popping here
        // too consumed two entries per click and eventually trapped users.
        navigate(-1);
        return;
      }
      if (fallback) navigate(fallback);
      else if (window.history.length > 1) navigate(-1);
      else navigate("/");
    },
    [navigate],
  );

  return <Ctx.Provider value={{ canGoBack, goBack }}>{children}</Ctx.Provider>;
};

export const useNavHistory = (): NavHistoryCtx => {
  const v = useContext(Ctx);
  if (!v) {
    // Safe fallback so components outside the provider still work.
    return {
      canGoBack: () => window.history.length > 1,
      goBack: (fallback?: string) => {
        if (window.history.length > 1) window.history.back();
        else if (fallback) window.location.assign(fallback);
      },
    };
  }
  return v;
};

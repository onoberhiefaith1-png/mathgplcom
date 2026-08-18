// Is the signed-in person allowed to manage the official asset library?
// Everyone else never sees a single management control.
//
// The answer depends on the Supabase session, which is restored asynchronously
// after the first render. A one-shot check on mount can therefore resolve while
// nobody is signed in yet and stay "false" for the rest of the visit — which is
// exactly how an Asset Manager ends up looking at a read-only library. The
// check is cached per signed-in user and re-run whenever the session changes.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { canManageLibrary } from "@/lib/gpl/assetLibrary";

let cachedUserId: string | null | undefined;
let cachedAnswer = false;
const listeners = new Set<(value: boolean) => void>();
let watching = false;

const evaluate = async (userId: string | null) => {
  const answer = userId ? await canManageLibrary().catch(() => false) : false;
  cachedUserId = userId;
  cachedAnswer = answer;
  listeners.forEach((fn) => fn(answer));
};

const refreshFromSession = async () => {
  const { data } = await supabase.auth.getSession();
  await evaluate(data.session?.user?.id ?? null);
};

const startWatching = () => {
  if (watching) return;
  watching = true;
  supabase.auth.onAuthStateChange((event, session) => {
    const userId = session?.user?.id ?? null;
    if (event === "TOKEN_REFRESHED" && userId === cachedUserId) return;
    void evaluate(userId);
  });
};

export const useAssetManager = () => {
  const [isManager, setIsManager] = useState(cachedAnswer);
  const [checked, setChecked] = useState(cachedUserId !== undefined);

  useEffect(() => {
    let alive = true;
    const onChange = (value: boolean) => {
      if (!alive) return;
      setIsManager(value);
      setChecked(true);
    };
    listeners.add(onChange);
    startWatching();
    void refreshFromSession().finally(() => {
      if (alive) setChecked(true);
    });
    return () => {
      alive = false;
      listeners.delete(onChange);
    };
  }, []);

  return { isManager, checked };
};

// Is the signed-in person allowed to manage the official asset library?
// Everyone else never sees a single management control.

import { useEffect, useState } from "react";
import { canManageLibrary } from "@/lib/gpl/assetLibrary";

export const useAssetManager = () => {
  const [isManager, setIsManager] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let alive = true;
    canManageLibrary()
      .then((allowed) => {
        if (alive) setIsManager(allowed);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setChecked(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { isManager, checked };
};

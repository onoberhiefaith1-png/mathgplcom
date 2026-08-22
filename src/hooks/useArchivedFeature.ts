// Application Archive switch.
//
// A retired application FEATURE (not a piece of content) is listed in
// `archived_features`. While archived, its UI is not mounted anywhere — the
// implementation stays in the codebase untouched, ready to be restored from the
// platform console.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ArchivedFeatureRow {
  feature_key: string;
  display_name: string;
  archived: boolean;
}

/** True while the feature is archived (so its UI must stay hidden). */
export const useArchivedFeature = (featureKey: string) => {
  const [archived, setArchived] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("archived_features")
        .select("archived")
        .eq("feature_key", featureKey)
        .maybeSingle();
      if (!cancelled) setArchived(Boolean(data?.archived));
    })();
    return () => { cancelled = true; };
  }, [featureKey]);

  return { archived, loading: archived === null };
};

/** Full archive list plus restore / archive actions (platform console). */
export const useApplicationArchive = () => {
  const [rows, setRows] = useState<ArchivedFeatureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("archived_features")
      .select("feature_key, display_name, archived")
      .order("display_name");
    if (err) setError(err.message);
    else {
      setError(null);
      setRows((data ?? []) as ArchivedFeatureRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const setArchived = useCallback(async (featureKey: string, archived: boolean) => {
    const { error: err } = await supabase
      .from("archived_features")
      .update({ archived })
      .eq("feature_key", featureKey);
    if (err) { setError(err.message); return; }
    setRows((prev) => prev.map((r) => (r.feature_key === featureKey ? { ...r, archived } : r)));
  }, []);

  return { rows, loading, error, reload: load, setArchived };
};

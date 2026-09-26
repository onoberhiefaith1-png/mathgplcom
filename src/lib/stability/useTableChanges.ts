/**
 * Re-run a loader whenever rows in a table change, and again after every
 * reconnect.
 *
 * A bare `supabase.channel().subscribe()` loses every event that happens while
 * the socket is down (laptop sleep, network switch) and never recovers. This
 * rides on useLiveChannel for retries and auth, and refetches after each
 * REJOIN so a change missed during the gap still shows up.
 */
import { useCallback, useEffect, useId, useRef } from "react";
import { useLiveChannel } from "./useLiveChannel";

export type TableWatch = {
  table: string;
  /** e.g. `class_id=eq.${classId}` */
  filter?: string;
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
};

export type TableChangesOptions = {
  /** Logical name; the hook adds a per-instance suffix so two components never replace each other's channel. */
  name: string;
  watch: TableWatch[];
  onChange: () => void;
  enabled?: boolean;
  /** Match the channel's existing setting when converting a raw channel. */
  private?: boolean;
};

export function useTableChanges({
  name,
  watch,
  onChange,
  enabled = true,
  private: isPrivate = false,
}: TableChangesOptions): void {
  const instance = useId();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const watchRef = useRef(watch);
  watchRef.current = watch;
  const hasJoinedBefore = useRef(false);

  useEffect(() => {
    hasJoinedBefore.current = false;
  }, [name, enabled]);

  const build = useCallback((channel: Parameters<Parameters<typeof useLiveChannel>[0]["build"]>[0]) => {
    for (const w of watchRef.current) {
      channel.on(
        "postgres_changes" as never,
        { event: w.event ?? "*", schema: "public", table: w.table, ...(w.filter ? { filter: w.filter } : {}) } as never,
        () => onChangeRef.current(),
      );
    }
  }, []);

  useLiveChannel({
    key: enabled ? `${name}:${instance}` : "",
    enabled,
    private: isPrivate,
    build,
    onJoined: () => {
      // The first join is covered by the caller's own initial load; only a
      // REJOIN needs a refetch to catch what was missed while disconnected.
      if (hasJoinedBefore.current) onChangeRef.current();
      hasJoinedBefore.current = true;
    },
  });
}

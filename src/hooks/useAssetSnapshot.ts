/**
 * "Add to Asset Library" bridge.
 *
 * The right-hand Properties Panel is the single editing surface, so the
 * *save-to-library* action lives there too — never as a floating chip on the
 * object. While a diagram is selected it publishes a snapshot of its own
 * ProseMirror node here; the panel reads that snapshot and offers to save it.
 */
import { useEffect, useSyncExternalStore } from "react";
import type { AssetSnapshot } from "@/lib/lessonnotes/assets/customAssets";

interface Entry {
  id: string;
  snapshot: () => AssetSnapshot | null;
}

let current: Entry | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const getSnapshot = () => current;
const getServerSnapshot = () => null;

/** Panel-side: the currently selected object's library snapshot, or null. */
export function useAssetSnapshot() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Asset-side. While `active` is true this object owns the library slot.
 * `snapshot` is called lazily, so it always reads the latest node state.
 */
export function useRegisterAssetSnapshot(
  active: boolean,
  id: string,
  snapshot: () => AssetSnapshot | null,
) {
  useEffect(() => {
    if (!active) return;
    current = { id, snapshot };
    emit();
    return () => {
      if (current?.id === id) {
        current = null;
        emit();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, id]);

  // Keep the callback fresh without churning the store identity.
  useEffect(() => {
    if (active && current?.id === id) current.snapshot = snapshot;
  }, [active, id, snapshot]);
}

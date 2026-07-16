// User-editable overrides for asset Standard Name / Short Code.
// Persisted to localStorage; read through the effective-name accessors
// so renamed assets appear everywhere immediately (@-menu, library).

import type { AssetDef } from "./types";

const STORAGE_KEY = "lessonnotes.assetOverrides";

export interface AssetOverride {
  label?: string;
  shortCode?: string;
}
export type OverrideMap = Record<string, AssetOverride>;

type Listener = () => void;
const listeners = new Set<Listener>();

function safeStorage(): Storage | null {
  try { return typeof window !== "undefined" ? window.localStorage : null; } catch { return null; }
}

function readAll(): OverrideMap {
  const s = safeStorage();
  if (!s) return {};
  try {
    const raw = s.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OverrideMap) : {};
  } catch { return {}; }
}

function writeAll(map: OverrideMap) {
  const s = safeStorage();
  if (!s) return;
  try { s.setItem(STORAGE_KEY, JSON.stringify(map)); } catch { /* quota, ignore */ }
  for (const l of listeners) l();
}

export function getOverrides(): OverrideMap { return readAll(); }

export function subscribeOverrides(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function getEffectiveLabel(a: AssetDef): string {
  return readAll()[a.id]?.label?.trim() || a.label;
}

/**
 * Normalise a Short Code: uppercase, alnum only, max 8 chars.
 */
export function normaliseShortCode(raw: string): string {
  return String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

/**
 * Effective Short Code for an asset. Falls back to the default computed
 * in the registry when no override is set.
 */
export function getEffectiveShortCode(a: AssetDef): string {
  const ov = readAll()[a.id]?.shortCode;
  const code = ov ? normaliseShortCode(ov) : a.shortCode || "";
  return code;
}

/**
 * Update an asset's label and/or short code.
 * Uniqueness is enforced across effective short codes of every asset.
 */
export function setOverride(
  target: AssetDef,
  patch: AssetOverride,
  allAssets: AssetDef[],
): { ok: true } | { ok: false; conflictWith: AssetDef } {
  const map = readAll();
  const nextEntry: AssetOverride = { ...(map[target.id] ?? {}) };

  if (patch.label !== undefined) {
    const trimmed = patch.label.trim();
    if (trimmed && trimmed !== target.label) nextEntry.label = trimmed;
    else delete nextEntry.label;
  }

  if (patch.shortCode !== undefined) {
    const code = normaliseShortCode(patch.shortCode);
    if (code) {
      // uniqueness check
      for (const other of allAssets) {
        if (other.id === target.id) continue;
        const otherCode = (map[other.id]?.shortCode
          ? normaliseShortCode(map[other.id]!.shortCode!)
          : other.shortCode || "");
        if (otherCode && otherCode === code) {
          return { ok: false, conflictWith: other };
        }
      }
      if (code !== (target.shortCode || "")) nextEntry.shortCode = code;
      else delete nextEntry.shortCode;
    } else {
      delete nextEntry.shortCode;
    }
  }

  if (Object.keys(nextEntry).length === 0) delete map[target.id];
  else map[target.id] = nextEntry;

  writeAll(map);
  return { ok: true };
}

export function clearOverride(id: string) {
  const map = readAll();
  if (map[id]) { delete map[id]; writeAll(map); }
}

// Paths of uploaded Game files. Built-in and official sounds are not storage objects.

const SLATE_ASSET = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/slate-assets\/[^/]+$/i;

export type MediaCopy = { from: string; to: string };

export function collectSlateAssetPaths(value: unknown, into = new Set<string>()): string[] {
  if (typeof value === "string") {
    if (SLATE_ASSET.test(value)) into.add(value);
    return [...into];
  }
  if (Array.isArray(value)) {
    for (const item of value) collectSlateAssetPaths(item, into);
    return [...into];
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) collectSlateAssetPaths(item, into);
  }
  return [...into];
}

/** Uploaded files a template actually references. Provenance is not itself a media file. */
export function referencedTemplateAssets(game: {
  background?: unknown;
  settings?: object | null;
  slots?: unknown;
}): string[] {
  const settings = { ...(game.settings ?? {}) } as Record<string, unknown>;
  delete settings.templateMedia;
  const found = new Set<string>();
  collectSlateAssetPaths(game.background, found);
  collectSlateAssetPaths(settings, found);
  collectSlateAssetPaths(game.slots, found);
  return [...found];
}

/**
 * Independent copies live under the new owner. The source owner's other files
 * are not included. Copying your own template keeps the same objects.
 */
export function planTemplateMediaCopy(
  paths: readonly string[],
  sourceOwnerId: string,
  nextOwnerId: string,
  nextName: () => string = () => crypto.randomUUID(),
): { copies: MediaCopy[]; unchanged: string[] } {
  if (!sourceOwnerId || sourceOwnerId === nextOwnerId) {
    return { copies: [], unchanged: [...paths] };
  }
  const copies: MediaCopy[] = [];
  const unchanged: string[] = [];
  for (const path of paths) {
    const owner = path.split("/")[0] ?? "";
    if (owner !== sourceOwnerId || !SLATE_ASSET.test(path)) {
      unchanged.push(path);
      continue;
    }
    const file = path.slice(path.lastIndexOf("/") + 1);
    const dot = file.lastIndexOf(".");
    const extension = dot > 0 ? file.slice(dot).toLowerCase() : "";
    copies.push({ from: path, to: `${nextOwnerId}/slate-assets/${nextName()}${extension}` });
  }
  return { copies, unchanged };
}

export function rewriteAssetPaths<T>(value: T, copies: readonly MediaCopy[]): T {
  if (copies.length === 0) return value;
  let json = JSON.stringify(value);
  const ordered = [...copies].sort((a, b) => b.from.length - a.from.length);
  for (const copy of ordered) json = json.split(copy.from).join(copy.to);
  return JSON.parse(json) as T;
}

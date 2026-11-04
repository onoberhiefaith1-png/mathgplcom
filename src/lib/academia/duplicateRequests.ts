/** Survives menu unmounts: an uncertain retry reuses its first server token. */
const requests = new Map<string, { id: string; promise?: Promise<unknown> }>();

export function runDuplicateRequest<T>(key: string, makeId: () => string, send: (id: string) => Promise<T>): Promise<T> {
  const existing = requests.get(key);
  if (existing?.promise) return existing.promise as Promise<T>;
  const entry = existing ?? { id: makeId() };
  requests.set(key, entry);
  const promise = Promise.resolve().then(() => send(entry.id)).then(result => {
    if (requests.get(key) === entry) requests.delete(key);
    return result;
  }, error => {
    entry.promise = undefined;
    throw error;
  });
  entry.promise = promise;
  return promise;
}

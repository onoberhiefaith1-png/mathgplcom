// Accepted AI lesson notes were disappearing a few seconds after Accept.
//
// The editor inserts the proposal locally, then a debounced save writes it.
// Meanwhile the open-time repair (idle callback, up to 3s) and the legacy
// block migration close over the document from when the note opened — often
// empty — and publish that snapshot with setNotebook + an UPDATE. The editor
// copies any new documentJson back onto the page when it is not focused
// (Accept has already closed the panel). Whichever write finishes last also
// wins in the database, so the note is gone on screen and after a reload.
//
// These helpers are the guard: a snapshot captured at open must not replace
// a document the teacher has since accepted, and database writes stay in
// order so an older request cannot land on top of a newer one.

export function documentPlainText(doc: unknown): string {
  const parts: string[] = [];
  const walk = (n: any) => {
    if (!n || typeof n !== "object") return;
    if (typeof n.text === "string" && n.text.trim()) parts.push(n.text);
    const value = n.attrs?.value;
    if (typeof value === "string" && value.trim()) parts.push(value);
    if (Array.isArray(n.content)) n.content.forEach(walk);
  };
  walk(doc);
  return parts.join("\n");
}

const flat = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * True when applying `incoming` would throw away text that is on the page now.
 * A formatting repair that keeps the opening and a similar length is allowed.
 * An empty shell, or an older shorter note, is not.
 */
export function incomingDropsLiveContent(live: unknown, incoming: unknown): boolean {
  const liveText = flat(documentPlainText(live));
  const nextText = flat(documentPlainText(incoming));
  if (!liveText) return false;
  if (!nextText) return true;
  if (nextText.includes(liveText)) return false;
  const sample = liveText.slice(0, 80);
  if (sample.length >= 12 && !nextText.includes(sample)) return true;
  return liveText.length > nextText.length + 40;
}

/** An open-time repair/migration may publish only if nothing newer has been accepted. */
export function shouldPublishOpenedSnapshot(
  capturedRevision: number,
  currentRevision: number,
  live: unknown,
  snapshot: unknown,
): boolean {
  if (capturedRevision !== currentRevision) return false;
  return !incomingDropsLiveContent(live, snapshot);
}

export type DocWrite = { json: unknown; revision: number };

/**
 * Serial document saves. A newer snapshot does not start until the previous
 * request finishes, and a job that is no longer the latest revision is not
 * sent. The last accepted document is what remains in the database.
 */
export function createDocWriteQueue(
  write: (json: unknown) => Promise<void>,
  stillCurrent: (job: DocWrite) => boolean,
): (job: DocWrite) => Promise<void> {
  let latest: DocWrite | null = null;
  let chain: Promise<void> = Promise.resolve();
  return (job: DocWrite) => {
    latest = job;
    let resolve!: () => void;
    let reject!: (error: unknown) => void;
    const done = new Promise<void>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    chain = chain
      .then(async () => {
        if (latest !== job || !stillCurrent(job)) {
          resolve();
          return;
        }
        try {
          await write(job.json);
          resolve();
        } catch (error) {
          reject(error);
        }
      })
      .catch(() => undefined);
    return done;
  };
}

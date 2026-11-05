// Game Library samples are the administrator's game row.
// Picking a sample uses that row. A later edit is what the next open reads.
// "Make my own copy" is the only fork: it freezes the slots at that moment.

export type LibrarySample = {
  id: string;
  name: string;
  library: boolean;
  ownerId: string;
  slots: string[];
};

/** What a teacher or student opens when they pick a library sample. */
export const libraryReaderView = <T extends { id: string }>(sample: T): T => sample;

/** A private game. It does not follow later edits of the sample it came from. */
export const forkLibrarySample = <T extends { id: string; name: string; library: boolean; ownerId: string }>(
  sample: T,
  next: { id: string; ownerId: string },
): T => ({
  ...sample,
  id: next.id,
  ownerId: next.ownerId,
  library: false,
  name: sample.name.endsWith(" copy") ? sample.name : `${sample.name} copy`,
});

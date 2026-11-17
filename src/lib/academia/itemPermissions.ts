/** Who may rename or delete an Academia catalog item (class … session). */

export type AcademiaItemKind = "class" | "subject" | "topic" | "subtopic" | "session";

export function canManageAcademiaItem(opts: {
  kind: AcademiaItemKind;
  isOrgOwner: boolean;
  userId?: string | null;
  createdBy?: string | null;
}): boolean {
  if (opts.isOrgOwner) return true;
  // Classes and subjects have no creator column and stay school-owner-only.
  if (opts.kind === "class" || opts.kind === "subject") return false;
  // NULL or missing created_by is owner-only.
  return Boolean(opts.userId && opts.createdBy && opts.userId === opts.createdBy);
}

/** Who may update or delete an activity card, matching the database rule. */
export function canManageAcademiaActivity(opts: {
  isOrgOwner: boolean;
  userId?: string | null;
  activityCreatedBy?: string | null;
  sessionCreatedBy?: string | null;
}): boolean {
  if (opts.isOrgOwner) return true;
  if (!opts.userId) return false;
  return opts.activityCreatedBy === opts.userId || opts.sessionCreatedBy === opts.userId;
}

/** Reorder of a session's tier batch: school owner or the session's creator. */
export function canReorderAcademiaSession(opts: {
  isOrgOwner: boolean;
  userId?: string | null;
  sessionCreatedBy?: string | null;
}): boolean {
  if (opts.isOrgOwner) return true;
  return Boolean(opts.userId && opts.sessionCreatedBy && opts.userId === opts.sessionCreatedBy);
}

export function trimmedAcademiaName(value: string): string {
  return value.trim();
}

export function academiaNameError(value: string, label = "name"): string | null {
  const name = trimmedAcademiaName(value);
  if (!name) return `Enter a ${label}.`;
  if (name.length > 200) return `That ${label} is too long.`;
  return null;
}

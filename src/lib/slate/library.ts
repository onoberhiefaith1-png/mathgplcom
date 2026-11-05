// Game templates.
//
// Sharing marks the sharer's own game row (library = true). The shelf reads
// that row, so the sharer's later edit is what the shelf shows next.
// "Copy to my games" is a snapshot: a new row, owned by the copier, with the
// shell (surfaces, rewards, sound, text, progress style) and no questions.
// A question assignment targets the copier's game, never someone else's template.

export type LibrarySample = {
  id: string;
  name: string;
  library: boolean;
  ownerId: string;
  slots: string[];
};

export type ShareActor = {
  /** platform owner or co-admin (`is_flow_admin`), or an account linked to one in `platform_test_accounts`. */
  isAdmin: boolean;
  /** Currently holds an app access code (`staff_codes.purpose = 'access'`). */
  holdsAccessCode: boolean;
};

export type TemplateQuestion = {
  id: string;
  notebookId?: string;
  subsectionId?: string;
};

/** What the shelf opens. It is the template row, including a later edit. */
export const libraryReaderView = <T extends { id: string }>(sample: T): T => sample;

/** Administrator, or anyone who currently holds an app access code. */
export const canShareGameToLibrary = (actor: ShareActor): boolean =>
  actor.isAdmin || actor.holdsAccessCode;

export const templateShareAction = (shared: boolean): "Share to templates" | "Remove from templates" =>
  shared ? "Remove from templates" : "Share to templates";

/**
 * Question assignment is allowed on a game this teacher owns (their copy, or
 * their own template). It is not allowed on another teacher's template.
 */
export const canAssignQuestions = (game: { ownerId?: string }, userId: string): boolean =>
  Boolean(userId) && game.ownerId === userId;

const copyName = (name: string): string =>
  name.endsWith(" copy") ? name : `${name} copy`;

/**
 * Independent snapshot of a template. The shell is cloned. Questions are not.
 * Play progress (lives, timer) starts fresh so the copy is not mid-game.
 */
export const copyGameTemplate = <T extends {
  id: string;
  name: string;
  library?: boolean;
  ownerId?: string;
  questions?: TemplateQuestion[];
  status?: { vaultsOpened: number; lives: number; timerEndsAt: number | null };
}>(
  template: T,
  next: { id: string; ownerId: string },
): T => {
  const shell = typeof structuredClone === "function"
    ? structuredClone(template)
    : JSON.parse(JSON.stringify(template)) as T;
  return {
    ...shell,
    id: next.id,
    ownerId: next.ownerId,
    library: false,
    name: copyName(template.name),
    questions: [],
    status: { vaultsOpened: 0, lives: 3, timerEndsAt: null },
  } as T;
};

/** A private game. It does not follow later edits of the template it came from. */
export const forkLibrarySample = <T extends { id: string; name: string; library?: boolean; ownerId?: string }>(
  sample: T,
  next: { id: string; ownerId: string },
): T => copyGameTemplate(sample, next);

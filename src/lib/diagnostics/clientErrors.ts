/**
 * The last few crashes on this device, kept so the next "This page didn't
 * load" can show (and the person can screenshot) what actually failed.
 * Tokens and secrets are stripped; nothing leaves the device from here.
 */
export const CLIENT_ERRORS_KEY = "mathgpl.lastErrors";
const MAX = 5;

export type ClientErrorRecord = { at: string; where: string; route: string; message: string; stack?: string };

const SECRETISH = /(bearer\s+\S+|eyJ[A-Za-z0-9_-]{8,}[A-Za-z0-9._-]*|api[_-]?secret\S*)/gi;

export function describeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Response) return { message: `Response ${error.status}${error.url ? ` at ${error.url}` : ""}` };
  if (error instanceof Error) return { message: `${error.name}: ${error.message}`, stack: error.stack };
  return { message: String(error) };
}

/** The error's message with anything token- or secret-like hidden, for showing on screen. */
export function safeErrorMessage(error: unknown): string {
  return describeError(error).message.replace(SECRETISH, "[hidden]").slice(0, 300);
}

export function recordClientError(error: unknown, where: string, storage?: Storage): ClientErrorRecord | null {
  if (typeof window === "undefined") return null;
  const { message, stack } = describeError(error);
  const record: ClientErrorRecord = {
    at: new Date().toISOString(),
    where,
    route: window.location.pathname,
    message: message.replace(SECRETISH, "[hidden]").slice(0, 500),
    ...(stack ? { stack: stack.replace(SECRETISH, "[hidden]").split("\n").slice(0, 8).join("\n").slice(0, 1500) } : {}),
  };
  try {
    const s = storage ?? window.localStorage;
    const list = readClientErrors(s);
    s.setItem(CLIENT_ERRORS_KEY, JSON.stringify([record, ...list].slice(0, MAX)));
  } catch { /* private mode */ }
  return record;
}

export function readClientErrors(storage?: Storage): ClientErrorRecord[] {
  try {
    const raw = (storage ?? window.localStorage).getItem(CLIENT_ERRORS_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? (list as ClientErrorRecord[]) : [];
  } catch {
    return [];
  }
}

/**
 * ROOM LOCK — the teacher's form, shared by the two places a lock is set: the
 * Add Room wizard (while the room is being created) and the room's own Settings
 * for → Lock section (afterwards).
 *
 * A lock is never automatic: a room has one only when a teacher adds it here.
 * The code is always typed twice and must match before it is accepted, and it
 * only ever travels to the server — nothing here reads a stored code back.
 */
import { useState } from "react";
import { Lock, LockOpen, Trash2 } from "lucide-react";
import {
  LOCK_CHARSET_LABEL,
  MAX_CODE_LENGTH,
  MIN_CODE_LENGTH,
  normaliseCode,
  validateCodePair,
} from "@/lib/building/lock";
import type { LockCharset, RoomLock } from "@/lib/building/lock";

/** What a lock is made of while it is being typed. */
export interface RoomLockDraft {
  charset: LockCharset;
  length: number;
  code: string;
  confirm: string;
}

export const emptyLockDraft = (): RoomLockDraft => ({
  charset: "digits",
  length: 4,
  code: "",
  confirm: "",
});

/** Null when the draft is acceptable, or the reason it is not. */
export const lockDraftProblem = (draft: RoomLockDraft): string | null =>
  validateCodePair(draft.code, draft.confirm, draft.charset, draft.length);

/**
 * The bare fields: characters, length, code, confirm code. Controlled, so the
 * wizard can carry them alongside the room it is about to create.
 */
export const RoomLockFields = ({
  draft,
  onChange,
}: {
  draft: RoomLockDraft;
  onChange: (next: RoomLockDraft) => void;
}) => (
  <div className="space-y-1.5">
    <div className="flex flex-wrap gap-1.5">
      <select
        aria-label="Code characters"
        value={draft.charset}
        onChange={(e) => onChange({ ...draft, charset: e.target.value as LockCharset })}
        className="min-h-[32px] rounded border border-border bg-background px-1.5 text-[11px] text-foreground"
      >
        {(Object.keys(LOCK_CHARSET_LABEL) as LockCharset[]).map((k) => (
          <option key={k} value={k}>
            {LOCK_CHARSET_LABEL[k]}
          </option>
        ))}
      </select>
      <select
        aria-label="Code length"
        value={draft.length}
        onChange={(e) => onChange({ ...draft, length: Number(e.target.value) })}
        className="min-h-[32px] rounded border border-border bg-background px-1.5 text-[11px] text-foreground"
      >
        {Array.from({ length: MAX_CODE_LENGTH - MIN_CODE_LENGTH + 1 }).map((_, i) => (
          <option key={i} value={MIN_CODE_LENGTH + i}>
            {MIN_CODE_LENGTH + i} characters
          </option>
        ))}
      </select>
    </div>
    <input
      aria-label="Access code"
      value={draft.code}
      maxLength={draft.length}
      placeholder={draft.charset === "digits" ? "Access code, e.g. 4821" : "Access code, e.g. MATH24"}
      onChange={(e) => onChange({ ...draft, code: normaliseCode(e.target.value) })}
      className="w-full rounded border border-border bg-background px-2 py-1 text-sm tracking-[0.3em] text-foreground"
    />
    <input
      aria-label="Confirm access code"
      value={draft.confirm}
      maxLength={draft.length}
      placeholder="Type the same code again"
      onChange={(e) => onChange({ ...draft, confirm: normaliseCode(e.target.value) })}
      className="w-full rounded border border-border bg-background px-2 py-1 text-sm tracking-[0.3em] text-foreground"
    />
  </div>
);

/**
 * The room's Lock section: add a lock, change its code, or take it off. Shown
 * only for a room — a lock is never a building-wide default.
 */
const RoomLockSettings = ({
  lock,
  onSetLock,
  onRemoveLock,
}: {
  lock: RoomLock | null;
  onSetLock: (code: string, charset: LockCharset, length: number) => Promise<void>;
  onRemoveLock: () => Promise<void>;
}) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<RoomLockDraft>(() => ({
    ...emptyLockDraft(),
    charset: lock?.charset ?? "digits",
    length: lock?.code_length ?? 4,
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const problem = lockDraftProblem(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSetLock(draft.code, draft.charset, draft.length);
      setDraft({ ...emptyLockDraft(), charset: draft.charset, length: draft.length });
      setOpen(false);
    } catch (e: unknown) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground">
        A lock belongs to this room. When it has one, learners must enter the code on
        the panel beside its entrance before the room opens.
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={`inline-flex min-h-[30px] items-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold ${
            lock ? "border-amber-500/50 text-amber-400" : "border-border text-muted-foreground"
          }`}
        >
          {lock ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
          {lock ? `Locked · ${lock.code_length} characters` : "No lock"}
        </span>
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v);
            setError(null);
          }}
          className="inline-flex min-h-[30px] items-center rounded-full border border-primary/50 px-2.5 text-[11px] font-semibold text-primary"
        >
          {lock ? "Change code" : "Add Lock"}
        </button>
        {lock && (
          <button
            type="button"
            aria-label="Remove lock"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onRemoveLock();
                setOpen(false);
              } catch (e: unknown) {
                setError(String((e as Error)?.message ?? e));
              } finally {
                setBusy(false);
              }
            }}
            className="inline-flex min-h-[30px] items-center gap-1 rounded-full border border-destructive/50 px-2.5 text-[11px] font-semibold text-destructive"
          >
            <Trash2 className="h-3 w-3" /> Remove Lock
          </button>
        )}
      </div>

      {open && (
        <div className="space-y-1.5 rounded-lg border border-border/60 bg-muted/40 p-2">
          <RoomLockFields draft={draft} onChange={setDraft} />
          {error && <p className="text-[11px] text-destructive">{error}</p>}
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="inline-flex min-h-[32px] items-center rounded-full bg-primary px-3 text-[11px] font-semibold text-primary-foreground disabled:opacity-60"
            >
              {lock ? "Save new code" : "Add Lock"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              className="inline-flex min-h-[32px] items-center rounded-full border border-border px-3 text-[11px] text-muted-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomLockSettings;

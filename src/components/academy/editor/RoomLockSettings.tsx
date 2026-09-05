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
  MAX_CODE_LENGTH,
  MIN_CODE_LENGTH,
  RETRY_OPTIONS,
  normaliseCode,
  retryLabel,
  validateCodePair,
} from "@/lib/building/lock";
import type { LockCharset, RoomLock } from "@/lib/building/lock";

/** What a lock is made of while it is being typed. */
export interface RoomLockDraft {
  charset: LockCharset;
  length: number;
  code: string;
  confirm: string;
  /** Optional security policy — off unless the teacher turns it on. */
  limitOn: boolean;
  maxAttempts: number;
  retryAfterMinutes: number;
}

export const emptyLockDraft = (): RoomLockDraft => ({
  charset: "digits",
  length: 4,
  code: "",
  confirm: "",
  limitOn: false,
  maxAttempts: 3,
  retryAfterMinutes: 1440,
});

/** Null when the draft is acceptable, or the reason it is not. */
export const lockDraftProblem = (draft: RoomLockDraft): string | null =>
  validateCodePair(draft.code, draft.confirm, "digits", draft.length);

/** The attempt policy a draft carries, in the shape the server expects. */
export const lockDraftPolicy = (draft: RoomLockDraft) => ({
  maxAttempts: draft.limitOn ? draft.maxAttempts : null,
  retryAfterMinutes: draft.limitOn ? draft.retryAfterMinutes : null,
});

/**
 * The bare fields: code length, the numeric code typed twice, and the optional
 * attempt limit. The lock is a NUMERIC keypad, so there is no character choice.
 */
export const RoomLockFields = ({
  draft,
  onChange,
}: {
  draft: RoomLockDraft;
  onChange: (next: RoomLockDraft) => void;
}) => (
  <div className="space-y-1.5">
    <select
      aria-label="Code length"
      value={draft.length}
      onChange={(e) => onChange({ ...draft, length: Number(e.target.value) })}
      className="min-h-[32px] rounded border border-border bg-background px-1.5 text-[11px] text-foreground"
    >
      {Array.from({ length: MAX_CODE_LENGTH - MIN_CODE_LENGTH + 1 }).map((_, i) => (
        <option key={i} value={MIN_CODE_LENGTH + i}>
          {MIN_CODE_LENGTH + i} digits
        </option>
      ))}
    </select>
    <input
      aria-label="Access code"
      inputMode="numeric"
      value={draft.code}
      maxLength={draft.length}
      placeholder="Access code, e.g. 4729"
      onChange={(e) =>
        onChange({ ...draft, code: normaliseCode(e.target.value).replace(/\D/g, "") })
      }
      className="w-full rounded border border-border bg-background px-2 py-1 text-sm tracking-[0.3em] text-foreground"
    />
    <input
      aria-label="Confirm access code"
      inputMode="numeric"
      value={draft.confirm}
      maxLength={draft.length}
      placeholder="Type the same code again"
      onChange={(e) =>
        onChange({ ...draft, confirm: normaliseCode(e.target.value).replace(/\D/g, "") })
      }
      className="w-full rounded border border-border bg-background px-2 py-1 text-sm tracking-[0.3em] text-foreground"
    />

    {/* OPTIONAL attempt limit. Off by default: learners may keep trying. */}
    <label className="flex items-center gap-1.5 text-[11px] text-foreground">
      <input
        type="checkbox"
        checked={draft.limitOn}
        onChange={(e) => onChange({ ...draft, limitOn: e.target.checked })}
      />
      Limit the number of attempts
    </label>
    {draft.limitOn && (
      <div className="flex flex-wrap gap-1.5">
        <select
          aria-label="Maximum attempts"
          value={draft.maxAttempts}
          onChange={(e) => onChange({ ...draft, maxAttempts: Number(e.target.value) })}
          className="min-h-[32px] rounded border border-border bg-background px-1.5 text-[11px] text-foreground"
        >
          {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
            <option key={n} value={n}>
              {n} attempt{n === 1 ? "" : "s"}
            </option>
          ))}
        </select>
        <select
          aria-label="Retry after"
          value={draft.retryAfterMinutes}
          onChange={(e) => onChange({ ...draft, retryAfterMinutes: Number(e.target.value) })}
          className="min-h-[32px] rounded border border-border bg-background px-1.5 text-[11px] text-foreground"
        >
          {RETRY_OPTIONS.map((m) => (
            <option key={m} value={m}>
              Retry after {retryLabel(m)}
            </option>
          ))}
        </select>
      </div>
    )}
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
  onResetAttempts,
}: {
  lock: RoomLock | null;
  onSetLock: (
    code: string,
    charset: LockCharset,
    length: number,
    policy: { maxAttempts: number | null; retryAfterMinutes: number | null },
  ) => Promise<void>;
  onRemoveLock: () => Promise<void>;
  onResetAttempts?: () => Promise<void>;
}) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<RoomLockDraft>(() => ({
    ...emptyLockDraft(),
    length: lock?.code_length ?? 4,
    limitOn: !!lock?.max_attempts,
    maxAttempts: lock?.max_attempts ?? 3,
    retryAfterMinutes: lock?.retry_after_minutes ?? 1440,
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
      await onSetLock(draft.code, "digits", draft.length, lockDraftPolicy(draft));
      setDraft({ ...draft, code: "", confirm: "" });
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

/**
 * DOOR SETTINGS — ACCESS LOCK. A door has no lock until a teacher adds one
 * here, and can lose it again at any time. The code is per door: it is sent
 * straight to the server, hashed there, and never read back.
 */
import { useState } from "react";
import { Lock, LockOpen, Trash2 } from "lucide-react";
import {
  LOCK_CHARSET_LABEL,
  MAX_CODE_LENGTH,
  MIN_CODE_LENGTH,
  normaliseCode,
  validateCode,
} from "@/lib/building/lock";
import type { DoorLock, LockCharset } from "@/lib/building/lock";

const DoorLockSettings = ({
  doorId,
  lock,
  onSetLock,
  onRemoveLock,
}: {
  doorId: string;
  lock: DoorLock | null;
  onSetLock: (doorId: string, code: string, charset: LockCharset, length: number) => Promise<void>;
  onRemoveLock: (doorId: string) => Promise<void>;
}) => {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [charset, setCharset] = useState<LockCharset>(lock?.charset ?? "digits");
  const [length, setLength] = useState<number>(lock?.code_length ?? 4);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const clean = normaliseCode(code);
    const problem = validateCode(clean, charset, length);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSetLock(doorId, clean, charset, length);
      setCode("");
      setOpen(false);
    } catch (e: unknown) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-1.5 py-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`inline-flex min-h-[30px] items-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold ${
            lock
              ? "border-amber-500/50 text-amber-400"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          {lock ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
          {lock ? `Locked · ${lock.code_length} characters` : "Add Lock"}
        </button>
        {lock && (
          <button
            type="button"
            aria-label="Remove lock"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onRemoveLock(doorId);
                setOpen(false);
              } finally {
                setBusy(false);
              }
            }}
            className="rounded p-1.5 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="mb-1.5 space-y-1.5 rounded-lg border border-border bg-muted/40 p-2">
          <p className="text-[11px] text-muted-foreground">
            {lock
              ? "Set a new access code for this door."
              : "Give this door an access code. Students must enter it on the panel beside the door."}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <select
              aria-label="Code characters"
              value={charset}
              onChange={(e) => setCharset(e.target.value as LockCharset)}
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
              value={length}
              onChange={(e) => setLength(Number(e.target.value))}
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
            value={code}
            maxLength={length}
            placeholder={charset === "digits" ? "e.g. 4821" : "e.g. MATH24"}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="w-full rounded border border-border bg-background px-2 py-1 text-sm tracking-[0.3em] text-foreground"
          />
          {error && <p className="text-[11px] text-destructive">{error}</p>}
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="inline-flex min-h-[32px] items-center rounded-full bg-primary px-3 text-[11px] font-semibold text-primary-foreground disabled:opacity-60"
            >
              {lock ? "Update code" : "Add Lock"}
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

export default DoorLockSettings;

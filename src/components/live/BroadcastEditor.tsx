import { Plus, Trash2 } from "lucide-react";
import {
  BROADCAST_PLATFORMS, BroadcastEntry, BroadcastPlatformId, fieldLabel, newBroadcastEntry,
} from "@/lib/live/broadcast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FIELD =
  "bg-muted text-foreground border-border placeholder:text-muted-foreground focus-visible:ring-primary";

type Props = {
  value: BroadcastEntry[];
  onChange: (next: BroadcastEntry[]) => void;
};

/**
 * Teacher-side editor: "you can access my class through these platforms".
 * Purely informational — nothing here connects to Zoom/WhatsApp/etc.
 */
const BroadcastEditor = ({ value, onChange }: Props) => {
  const update = (id: string, patch: Partial<BroadcastEntry>) =>
    onChange(value.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const remove = (id: string) => onChange(value.filter((e) => e.id !== id));

  return (
    <div className="space-y-3">
      <div>
        <Label>Broadcast Platform</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Where will this class be streamed? Participants see only what you fill in here.
        </p>
      </div>

      {value.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          No platform added yet.
        </div>
      )}

      {value.map((entry) => (
        <div key={entry.id} className="space-y-3 rounded-xl border border-border bg-card/40 p-3">
          <div className="flex items-center gap-2">
            <select
              aria-label="Platform"
              value={entry.platform}
              onChange={(e) => update(entry.id, { platform: e.target.value as BroadcastPlatformId })}
              className={`h-10 flex-1 rounded-md border px-3 text-sm outline-hidden focus:border-primary ${FIELD}`}
            >
              {BROADCAST_PLATFORMS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => remove(entry.id)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Remove platform"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {entry.platform === "other" && (
            <Input
              className={FIELD}
              placeholder="Platform name"
              value={entry.customName ?? ""}
              onChange={(e) => update(entry.id, { customName: e.target.value })}
            />
          )}

          <Input
            className={FIELD}
            placeholder={fieldLabel(entry.platform, "link")}
            value={entry.link ?? ""}
            onChange={(e) => update(entry.id, { link: e.target.value })}
            inputMode="url"
            autoComplete="off"
          />

          <div className="grid grid-cols-2 gap-2">
            <Input
              className={FIELD}
              placeholder={fieldLabel(entry.platform, "code")}
              value={entry.code ?? ""}
              onChange={(e) => update(entry.id, { code: e.target.value })}
              autoComplete="off"
            />
            <Input
              className={FIELD}
              placeholder={fieldLabel(entry.platform, "password")}
              value={entry.password ?? ""}
              onChange={(e) => update(entry.id, { password: e.target.value })}
              autoComplete="off"
            />
          </div>

          <Input
            className={FIELD}
            placeholder="Note (optional) — e.g. join 5 minutes early"
            value={entry.note ?? ""}
            onChange={(e) => update(entry.id, { note: e.target.value })}
          />
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...value, newBroadcastEntry()])}
        className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent"
      >
        <Plus className="h-4 w-4" /> Add platform
      </button>
    </div>
  );
};

export default BroadcastEditor;

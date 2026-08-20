import { cn } from "@/lib/utils";

export type SaveState = "idle" | "saving" | "saved" | "unsaved" | "offline" | "syncing" | "error";

const LABEL: Record<SaveState, string> = {
  idle: "",
  saving: "Saving…",
  saved: "Saved",
  unsaved: "Unsaved changes",
  offline: "Offline — changes stored on this device",
  syncing: "Connection restored — syncing…",
  error: "Couldn't save — retrying",
};

/** The teacher must never wonder whether their lesson has been saved. */
const SaveStatusPill = ({ state, className }: { state: SaveState; className?: string }) => {
  if (state === "idle") return null;
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        state === "saved" && "border-border bg-muted text-muted-foreground",
        (state === "saving" || state === "syncing") && "border-border bg-muted text-foreground",
        state === "unsaved" && "border-amber-300 bg-amber-50 text-amber-900",
        (state === "offline" || state === "error") && "border-rose-300 bg-rose-50 text-rose-900",
        className,
      )}
    >
      {LABEL[state]}
    </span>
  );
};

export default SaveStatusPill;

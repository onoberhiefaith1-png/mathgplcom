// Official GPL emoji on Smartboard Board 1. Reads the same central library as
// the Lesson Note panel, so an emoji deactivated in /admin/assets disappears
// here too. Board 2 is a lesson-note editor and already shows the panel.

import { useState } from "react";
import { Smile, X } from "lucide-react";
import OfficialEmojiSection from "@/components/gpl/OfficialEmojiSection";

interface Props {
  onInsert: (glyph: string) => void;
  chromeBg: string;
  chromeFg: string;
  chromeBorder: string;
  ink: string;
  /** Bottom inset (px) so the button clears the bottom panel tab. */
  bottomInset: number;
}

const BoardEmojiDock = ({ onInsert, chromeBg, chromeFg, chromeBorder, ink, bottomInset }: Props) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        data-sb-chrome
        type="button"
        aria-label="Official GPL emoji"
        title="Official GPL emoji"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="absolute z-40 grid place-items-center rounded-full border transition-all"
        style={{
          left: 12,
          bottom: bottomInset + 68,
          width: 44,
          height: 44,
          background: chromeBg,
          color: open ? ink : chromeFg,
          borderColor: open ? ink : chromeBorder,
          backdropFilter: "blur(10px)",
          opacity: 0.95,
        }}
      >
        <Smile className="h-5 w-5" />
      </button>

      {open && (
        <aside
          data-sb-chrome
          aria-label="Official GPL emoji"
          onClick={(e) => e.stopPropagation()}
          className="absolute z-40 flex max-h-[60%] w-64 flex-col overflow-hidden rounded-xl border bg-background/95 shadow-xl backdrop-blur"
          style={{ left: 64, bottom: bottomInset + 68, borderColor: chromeBorder }}
        >
          <div className="flex h-9 items-center justify-between border-b border-border px-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground/80">
              Official GPL emoji
            </span>
            <button
              type="button"
              aria-label="Close emoji panel"
              onClick={() => setOpen(false)}
              className="rounded p-1 text-foreground/70 hover:bg-muted/60"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <OfficialEmojiSection onInsert={onInsert} enabled={open} />
          </div>
        </aside>
      )}
    </>
  );
};

export default BoardEmojiDock;

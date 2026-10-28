// Official GPL emoji, read from the central library. Shared by Lesson Notes,
// Smartboard Board 1 and Smartboard Board 2 so there is only one record.

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useOfficialEmoji } from "@/lib/gpl/officialEmoji";

interface Props {
  onInsert: (text: string) => void;
  /** Set when the panel is mounted, so the fetch only runs where it is shown. */
  enabled?: boolean;
}

const OfficialEmojiSection = ({ onInsert, enabled = true }: Props) => {
  const { groups, loading } = useOfficialEmoji(enabled);
  const [collapsed, setCollapsed] = useState(false);

  if (loading || groups.length === 0) return null;

  return (
    <div className="border-b border-border p-2">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="mb-1 flex w-full items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-primary"
      >
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        Official GPL
      </button>
      {!collapsed && (
        <div className="max-h-52 space-y-2 overflow-y-auto overscroll-contain">
          {groups.map((group) => (
            <div key={group.id}>
              <p className="px-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                {group.name}
              </p>
              <div className="grid grid-cols-6 gap-1">
                {group.glyphs.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    title={item.name}
                    onClick={() => onInsert(item.glyph)}
                    className="h-9 rounded text-xl leading-none transition hover:bg-muted/70 active:scale-95"
                  >
                    {item.glyph}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OfficialEmojiSection;

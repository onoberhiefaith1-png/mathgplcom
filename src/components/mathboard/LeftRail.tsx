import { Bookmark, Clock, FileEdit, Monitor, Settings, Trophy, Zap } from "lucide-react";

const items = [
  { icon: Monitor, label: "Workspace", active: true },
  { icon: Clock, label: "History" },
  { icon: FileEdit, label: "Notes" },
  { icon: Bookmark, label: "Bookmarks" },
  { icon: Trophy, label: "Achievements" },
  { icon: Settings, label: "Settings" },
];

export const LeftRail = () => (
  <aside className="hidden md:flex w-48 shrink-0 flex-col justify-between border-r border-amber-200/15 bg-card/30 px-3 py-4 backdrop-blur">
    <nav className="space-y-1">
      {items.map((it) => (
        <button
          key={it.label}
          className={[
            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
            it.active
              ? "bg-cyan-500/10 text-cyan-200 border border-cyan-400/40 shadow-[0_0_18px_hsl(200_90%_60%/0.2)]"
              : "text-muted-foreground hover:bg-muted/30 hover:text-foreground",
          ].join(" ")}
        >
          <it.icon className="h-4 w-4" />
          <span>{it.label}</span>
        </button>
      ))}
    </nav>
    <div className="flex items-center gap-3 rounded-2xl border border-cyan-400/30 bg-background/40 px-3 py-2.5">
      <div className="relative">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-cyan-400/60 text-cyan-300">
          <Zap className="h-4 w-4" />
        </div>
      </div>
      <div className="leading-tight">
        <div className="text-xs font-bold text-cyan-200">100%</div>
        <div className="text-[10px] text-muted-foreground">Energy</div>
      </div>
    </div>
  </aside>
);

export default LeftRail;

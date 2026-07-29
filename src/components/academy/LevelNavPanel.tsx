import { useState } from "react";
import { Link } from "@/lib/router-compat";
import { ChevronLeft, ChevronRight, Layers } from "lucide-react";
import { levels } from "@/data/levels";

/** Side panel offering 5 alias entry points (Level/Age/Grade/Year/Class).
 *  Every option routes to /levels/:id — one shared folder per level. */
const LevelNavPanel = () => {
  const [open, setOpen] = useState(false);

  const groups: { label: string; items: { label: string; to: string }[] }[] = [
    {
      label: "Levels",
      items: levels.map((l) => ({ label: `Level ${l.id}`, to: `/levels/${l.id}` })),
    },
    {
      label: "Age",
      items: levels.map((l) => ({ label: `Age ${l.ageRange}`, to: `/levels/${l.id}` })),
    },
    {
      label: "Grade (US)",
      items: levels.map((l) => ({ label: `Grade ${l.usGrade}`, to: `/levels/${l.id}` })),
    },
    {
      label: "Year (UK)",
      items: levels.map((l) => ({ label: `Year ${l.ukYear}`, to: `/levels/${l.id}` })),
    },
    {
      label: "Class (Nigeria)",
      items: levels.map((l) => ({ label: l.ngClass, to: `/levels/${l.id}` })),
    },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close levels panel" : "Open levels panel"}
        className="fixed left-4 top-1/2 z-40 inline-flex -translate-y-1/2 items-center gap-2 rounded-r-full border border-primary/40 bg-background/70 px-3 py-3 text-primary shadow-lg backdrop-blur transition hover:bg-primary hover:text-primary-foreground"
      >
        {open ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <Layers className="h-4 w-4" />
      </button>

      <aside
        className={`fixed left-0 top-0 z-30 h-screen w-72 overflow-y-auto border-r border-border/60 bg-background/85 p-5 pt-20 backdrop-blur transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!open}
      >
        <h2 className="mb-4 text-xs uppercase tracking-[0.35em] text-primary">
          Choose your level
        </h2>
        <p className="mb-5 text-xs text-muted-foreground">
          Every label below opens the same shared content folder for that level.
        </p>

        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="mb-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                {group.label}
              </p>
              <ul className="grid grid-cols-2 gap-2">
                {group.items.map((item) => (
                  <li key={`${group.label}-${item.label}`}>
                    <Link
                      to={item.to}
                      onClick={() => setOpen(false)}
                      className="block rounded-md border border-border/50 bg-background/60 px-2 py-1.5 text-center text-xs text-foreground transition hover:border-primary hover:text-primary"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
};

export default LevelNavPanel;

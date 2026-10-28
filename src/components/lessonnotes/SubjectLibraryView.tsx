import { searchSubject, type SubjectEntry, type SubjectLibrary } from "@/lib/lessonnotes/assets/subjects";

function EntryTile({ en, onPick }: { en: SubjectEntry; onPick: (en: SubjectEntry) => void }) {
  const pending = en.status === "pending";
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => onPick(en)}
      title={[en.meaning, en.unit && `Unit: ${en.unit}`, en.alsoMeans?.length && `Also: ${en.alsoMeans.join(", ")}`].filter(Boolean).join("\n")}
      className={
        "flex flex-col items-center justify-center gap-0.5 rounded-md border p-2 text-center min-h-[78px] transition-colors " +
        (pending ? "border-dashed opacity-60 cursor-not-allowed" : "hover:bg-primary/5 hover:border-primary/40")
      }
    >
      <span className="text-base font-semibold text-foreground break-all leading-tight">{en.symbol}</span>
      <span className="text-[10px] text-muted-foreground leading-tight line-clamp-2">{en.meaning}</span>
      {en.unit && <span className="text-[10px] font-mono text-foreground/70">{en.unit}</span>}
      {en.alsoMeans?.length ? <span className="text-[9px] text-muted-foreground">also {en.alsoMeans.join(", ")}</span> : null}
      {pending && <span className="text-[9px] font-semibold uppercase text-muted-foreground">Pending</span>}
      {en.review && !pending && <span className="text-[9px] text-primary">review</span>}
    </button>
  );
}

const GRID = "grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2";

export function SubjectLibraryView({ lib, q, onPick }: { lib: SubjectLibrary; q: string; onPick: (en: SubjectEntry) => void }) {
  if (lib.status === "coming-soon") {
    return (
      <div className="py-16 text-center">
        <p className="text-lg font-semibold">{lib.name} library coming soon</p>
        <p className="text-sm text-muted-foreground mt-1">This subject's assets will be added in a later phase.</p>
      </div>
    );
  }
  if (q.trim()) {
    const res = searchSubject(lib, q);
    return (
      <section>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          {res.length} {lib.name} result{res.length === 1 ? "" : "s"} for "{q}"
        </h3>
        <div className={GRID}>{res.map((en) => <EntryTile key={en.id} en={en} onPick={onPick} />)}</div>
      </section>
    );
  }
  return (
    <>
      {lib.sections.map((s) => (
        <section key={s.id}>
          <h3 className="text-sm font-semibold uppercase tracking-wide mb-1">{s.name} · {s.entries.length}</h3>
          {s.desc && <p className="text-xs text-muted-foreground mb-2">{s.desc}</p>}
          <div className={GRID}>{s.entries.map((en) => <EntryTile key={en.id} en={en} onPick={onPick} />)}</div>
        </section>
      ))}
    </>
  );
}
